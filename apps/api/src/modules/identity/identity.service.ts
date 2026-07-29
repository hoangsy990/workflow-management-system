import type { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword } from "../../security/hash.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { badRequest, conflict, notFound } from "../../http/errors.js";

export async function listUsers(db: PrismaClient, input: { page: number; pageSize: number; keyword?: string }) {
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(input.keyword
      ? {
          OR: [
            { fullName: { contains: input.keyword, mode: "insensitive" } },
            { email: { contains: input.keyword, mode: "insensitive" } },
            { employeeCode: { contains: input.keyword, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const [data, total] = await Promise.all([
    db.user.findMany({
      where,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        title: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        department: { select: { id: true, code: true, name: true } },
        manager: { select: { id: true, fullName: true } },
        roles: { include: { role: true } }
      }
    }),
    db.user.count({ where })
  ]);

  return { data, total };
}

export async function createUser(
  db: PrismaClient,
  actorId: string,
  input: {
    employeeCode: string;
    fullName: string;
    email: string;
    phone?: string;
    password: string;
    avatarUrl?: string;
    title?: string;
    departmentId?: string;
    managerId?: string;
    roleIds?: string[];
  }
) {
  const existed = await db.user.findFirst({
    where: { OR: [{ email: input.email }, { employeeCode: input.employeeCode }] }
  });
  if (existed) {
    throw conflict("Email hoặc mã nhân viên đã tồn tại.");
  }

  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        employeeCode: input.employeeCode,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        passwordHash: await hashPassword(input.password),
        avatarUrl: input.avatarUrl,
        title: input.title,
        departmentId: input.departmentId,
        managerId: input.managerId,
        roles: input.roleIds?.length
          ? {
              createMany: {
                data: input.roleIds.map((roleId) => ({ roleId })),
                skipDuplicates: true
              }
            }
          : undefined
      },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        email: true,
        status: true,
        createdAt: true
      }
    });

    await writeAuditLog(tx, {
      actorId,
      action: "user.create",
      entityType: "users",
      entityId: user.id
    });

    return user;
  });
}

export async function updateUser(
  db: PrismaClient,
  actorId: string,
  id: string,
  input: {
    fullName?: string;
    phone?: string | null;
    avatarUrl?: string | null;
    title?: string | null;
    departmentId?: string | null;
    managerId?: string | null;
    status?: "ACTIVE" | "INACTIVE" | "LOCKED";
    roleIds?: string[];
  }
) {
  const existing = await db.user.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    throw notFound("Không tìm thấy người dùng.");
  }

  return db.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: {
        fullName: input.fullName,
        phone: input.phone,
        avatarUrl: input.avatarUrl,
        title: input.title,
        departmentId: input.departmentId,
        managerId: input.managerId,
        status: input.status
      },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        email: true,
        status: true
      }
    });

    if (input.roleIds) {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({
        data: input.roleIds.map((roleId) => ({ userId: id, roleId })),
        skipDuplicates: true
      });
    }

    await writeAuditLog(tx, {
      actorId,
      action: "user.update",
      entityType: "users",
      entityId: id
    });

    return user;
  });
}

export async function listDepartments(db: PrismaClient) {
  return db.department.findMany({
    where: { deletedAt: null },
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
    include: {
      manager: { select: { id: true, fullName: true } },
      branch: { select: { id: true, name: true } },
      parent: { select: { id: true, code: true, name: true } },
      _count: { select: { users: true, tasks: true } }
    }
  });
}

async function assertValidDepartmentParent(db: PrismaClient, id: string | undefined, parentId: string | null | undefined) {
  if (!parentId) return;
  if (id && parentId === id) {
    throw badRequest("Phòng ban cha không được trùng với phòng ban đang chỉnh sửa.");
  }

  let cursor = await db.department.findUnique({
    where: { id: parentId },
    select: { id: true, parentId: true, deletedAt: true }
  });
  if (!cursor || cursor.deletedAt) {
    throw notFound("Không tìm thấy phòng ban cha.");
  }

  const visited = new Set<string>();
  while (cursor?.parentId) {
    if (id && cursor.parentId === id) {
      throw badRequest("Không thể tạo quan hệ vòng lặp trong cơ cấu phòng ban.");
    }
    if (visited.has(cursor.parentId)) {
      throw badRequest("Cơ cấu phòng ban hiện có quan hệ vòng lặp.");
    }
    visited.add(cursor.parentId);
    cursor = await db.department.findUnique({
      where: { id: cursor.parentId },
      select: { id: true, parentId: true, deletedAt: true }
    });
  }
}

export async function upsertDepartment(
  db: PrismaClient,
  actorId: string,
  input: {
    id?: string;
    code: string;
    name: string;
    description?: string;
    parentId?: string | null;
    managerId?: string | null;
  }
) {
  await assertValidDepartmentParent(db, input.id, input.parentId);

  return db.$transaction(async (tx) => {
    const department = input.id
      ? await tx.department.update({
          where: { id: input.id },
          data: {
            code: input.code,
            name: input.name,
            description: input.description,
            parentId: input.parentId,
            managerId: input.managerId
          }
        })
      : await tx.department.create({
          data: {
            code: input.code,
            name: input.name,
            description: input.description,
            parentId: input.parentId,
            managerId: input.managerId
          }
        });

    await writeAuditLog(tx, {
      actorId,
      action: input.id ? "department.update" : "department.create",
      entityType: "departments",
      entityId: department.id
    });

    return department;
  });
}

export async function listRoles(db: PrismaClient) {
  return db.role.findMany({
    orderBy: { name: "asc" },
    include: {
      permissions: {
        include: { permission: true }
      },
      _count: { select: { users: true } }
    }
  });
}

export async function listPermissions(db: PrismaClient) {
  return db.permission.findMany({ orderBy: [{ group: "asc" }, { code: "asc" }] });
}

export async function createRole(
  db: PrismaClient,
  actorId: string,
  input: { code: string; name: string; description?: string; permissionIds?: string[] }
) {
  return db.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        permissions: input.permissionIds?.length
          ? {
              createMany: {
                data: input.permissionIds.map((permissionId) => ({ permissionId })),
                skipDuplicates: true
              }
            }
          : undefined
      }
    });

    await writeAuditLog(tx, {
      actorId,
      action: "role.create",
      entityType: "roles",
      entityId: role.id
    });

    return role;
  });
}

export async function updateRolePermissions(db: PrismaClient, actorId: string, roleId: string, permissionIds: string[]) {
  return db.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId } });
    await tx.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      skipDuplicates: true
    });
    await writeAuditLog(tx, {
      actorId,
      action: "role.permissions.update",
      entityType: "roles",
      entityId: roleId
    });
    return { ok: true };
  });
}
