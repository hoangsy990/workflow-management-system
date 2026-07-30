import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { config } from "../../config.js";
import { badRequest, forbidden, unauthorized } from "../../http/errors.js";
import { createOpaqueToken, hashToken, verifyPassword } from "../../security/hash.js";
import { writeAuditLog } from "../audit/audit.service.js";

export interface LoginInput {
  email: string;
  password: string;
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function getUserAuthContext(db: PrismaClient, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true }
              }
            }
          }
        }
      },
      department: true,
      manager: {
        select: { id: true, fullName: true }
      }
    }
  });

  if (!user || user.deletedAt || user.status !== "ACTIVE") {
    throw unauthorized();
  }

  return {
    id: user.id,
    employeeCode: user.employeeCode,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    title: user.title,
    department: user.department ? { id: user.department.id, name: user.department.name, code: user.department.code } : null,
    manager: user.manager,
    lastLoginAt: user.lastLoginAt,
    roles: user.roles.map((item) => ({ code: item.role.code, name: item.role.name })),
    permissions: [
      ...new Set(user.roles.flatMap((item) => item.role.permissions.map((permission) => permission.permission.code)))
    ]
  };
}

export async function login(db: PrismaClient, app: FastifyInstance, input: LoginInput) {
  const user = await db.user.findUnique({ where: { email: input.email } });

  if (!user || user.deletedAt) {
    throw unauthorized("Email hoặc mật khẩu không đúng.");
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw forbidden("Tài khoản đang bị tạm khóa do đăng nhập sai nhiều lần.");
  }

  if (user.status !== "ACTIVE") {
    throw forbidden("Tài khoản không còn hoạt động.");
  }

  const isValid = await verifyPassword(input.password, user.passwordHash);
  if (!isValid) {
    const attempts = user.failedLoginAttempts + 1;
    const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil
      }
    });
    throw unauthorized("Email hoặc mật khẩu không đúng.");
  }

  const refreshToken = createOpaqueToken();
  const expiresAt = addDays(new Date(), config.REFRESH_TOKEN_TTL_DAYS);

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date()
      }
    });
    await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        deviceName: input.deviceName,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        expiresAt
      }
    });
    await writeAuditLog(tx, {
      actorId: user.id,
      action: "auth.login",
      entityType: "users",
      entityId: user.id,
      ipAddress: input.ipAddress
    });
  });

  const accessToken = app.jwt.sign({ sub: user.id }, { expiresIn: config.ACCESS_TOKEN_TTL });
  const profile = await getUserAuthContext(db, user.id);

  return {
    user: profile,
    accessToken,
    refreshToken,
    expiresIn: config.ACCESS_TOKEN_TTL
  };
}

export async function refreshAccessToken(db: PrismaClient, app: FastifyInstance, refreshToken: string) {
  if (!refreshToken) {
    throw badRequest("Refresh token là bắt buộc.");
  }

  const token = await db.refreshToken.findFirst({
    where: {
      tokenHash: hashToken(refreshToken),
      revokedAt: null,
      expiresAt: { gt: new Date() }
    },
    include: { user: true }
  });

  if (!token || token.user.status !== "ACTIVE" || token.user.deletedAt) {
    throw unauthorized("Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
  }

  return {
    accessToken: app.jwt.sign({ sub: token.userId }, { expiresIn: config.ACCESS_TOKEN_TTL }),
    expiresIn: config.ACCESS_TOKEN_TTL
  };
}

export async function logout(db: PrismaClient, userId: string, refreshToken?: string) {
  if (refreshToken) {
    await db.refreshToken.updateMany({
      where: { userId, tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() }
    });
    return;
  }

  await db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

export async function revokeAllAuthSessions(db: PrismaClient, userId: string, ipAddress?: string) {
  const result = await db.$transaction(async (tx) => {
    const updated = await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    await writeAuditLog(tx, {
      actorId: userId,
      action: "auth.session.revoke_all",
      entityType: "users",
      entityId: userId,
      ipAddress,
      metadata: { revokedSessions: updated.count }
    });

    return updated;
  });

  return { revokedSessions: result.count };
}

export async function listAuthSessions(db: PrismaClient, userId: string) {
  return db.refreshToken.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      deviceName: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      expiresAt: true
    }
  });
}

export async function revokeAuthSession(db: PrismaClient, userId: string, sessionId: string, ipAddress?: string) {
  const result = await db.$transaction(async (tx) => {
    const updated = await tx.refreshToken.updateMany({
      where: {
        id: sessionId,
        userId,
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });

    if (updated.count > 0) {
      await writeAuditLog(tx, {
        actorId: userId,
        action: "auth.session.revoke",
        entityType: "refresh_tokens",
        entityId: sessionId,
        ipAddress
      });
    }

    return updated;
  });

  if (result.count === 0) {
    throw badRequest("Phiên đăng nhập không tồn tại hoặc đã bị thu hồi.");
  }
}
