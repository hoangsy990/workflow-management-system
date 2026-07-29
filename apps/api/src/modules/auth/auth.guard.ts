import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../prisma.js";
import { forbidden, unauthorized } from "../../http/errors.js";

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
  try {
    const payload = await request.jwtVerify<{ sub: string }>();
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user || user.deletedAt || user.status !== "ACTIVE") {
      throw unauthorized();
    }

    request.auth = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      departmentId: user.departmentId,
      managerId: user.managerId,
      roles: user.roles.map((item) => item.role.code),
      permissions: [
        ...new Set(user.roles.flatMap((item) => item.role.permissions.map((permission) => permission.permission.code)))
      ]
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("No Authorization")) {
      throw unauthorized();
    }
    throw error;
  }
}

export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(request, reply);
    if (!request.auth?.permissions.includes(permission)) {
      throw forbidden();
    }
  };
}

