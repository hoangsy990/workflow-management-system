import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { paginate, paginationSchema } from "../../http/pagination.js";
import { parseQuery } from "../../http/validation.js";
import { requirePermission } from "../auth/auth.guard.js";

const querySchema = paginationSchema.extend({
  actorId: z.string().uuid().optional(),
  entityType: z.string().optional(),
  action: z.string().optional()
});

export async function auditRoutes(app: FastifyInstance) {
  app.get("/activity-logs", { preHandler: requirePermission("audit.read") }, async (request) => {
    const query = parseQuery(request, querySchema);
    const where = {
      actorId: query.actorId,
      entityType: query.entityType,
      action: query.action ? { contains: query.action, mode: "insensitive" as const } : undefined
    };
    const [data, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { id: true, fullName: true, email: true } } }
      }),
      prisma.activityLog.count({ where })
    ]);
    return paginate(data, query.page, query.pageSize, total);
  });
}

