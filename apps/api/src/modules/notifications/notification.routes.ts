import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { paginate, paginationSchema } from "../../http/pagination.js";
import { parseBody, parseParams, parseQuery } from "../../http/validation.js";
import { requireAuth, requirePermission } from "../auth/auth.guard.js";
import { runDeadlineNotificationScan } from "./notification.service.js";

const idParamSchema = z.object({ id: z.string().uuid() });
const deviceTokenSchema = z.object({
  platform: z.enum(["web", "windows", "android", "ios"]),
  token: z.string().min(8),
  deviceName: z.string().optional()
});

export async function notificationRoutes(app: FastifyInstance) {
  app.get("/notifications", { preHandler: requireAuth }, async (request) => {
    const query = parseQuery(request, paginationSchema);
    const where = { userId: request.auth!.userId };
    const [data, total, unread] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: "desc" }
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: request.auth!.userId, readAt: null } })
    ]);
    return { ...paginate(data, query.page, query.pageSize, total), unread };
  });

  app.post("/notifications/:id/read", { preHandler: requireAuth }, async (request) => {
    const params = parseParams(request, idParamSchema);
    await prisma.notification.updateMany({
      where: { id: params.id, userId: request.auth!.userId },
      data: { readAt: new Date() }
    });
    return { ok: true };
  });

  app.post("/notifications/read-all", { preHandler: requireAuth }, async (request) => {
    await prisma.notification.updateMany({
      where: { userId: request.auth!.userId, readAt: null },
      data: { readAt: new Date() }
    });
    return { ok: true };
  });

  app.post("/notifications/run-deadline-scan", { preHandler: requirePermission("setting.manage") }, async () =>
    runDeadlineNotificationScan(prisma)
  );

  app.post("/device-tokens", { preHandler: requireAuth }, async (request) => {
    const body = parseBody(request, deviceTokenSchema);
    return prisma.deviceToken.upsert({
      where: { platform_token: { platform: body.platform, token: body.token } },
      update: {
        userId: request.auth!.userId,
        deviceName: body.deviceName,
        lastSeenAt: new Date()
      },
      create: {
        userId: request.auth!.userId,
        platform: body.platform,
        token: body.token,
        deviceName: body.deviceName
      }
    });
  });
}
