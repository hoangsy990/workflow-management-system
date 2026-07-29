import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { parseBody } from "../../http/validation.js";
import { requireAuth, requirePermission } from "../auth/auth.guard.js";
import { writeAuditLog } from "../audit/audit.service.js";

const settingSchema = z.object({
  key: z.string().min(2),
  value: z.unknown(),
  description: z.string().optional()
});

export async function settingsRoutes(app: FastifyInstance) {
  app.get("/system-settings", { preHandler: requireAuth }, async () => {
    return prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
  });

  app.put("/system-settings", { preHandler: requirePermission("setting.manage") }, async (request) => {
    const body = parseBody(request, settingSchema);
    const setting = await prisma.systemSetting.upsert({
      where: { key: body.key },
      update: { value: body.value as Prisma.InputJsonValue, description: body.description },
      create: { key: body.key, value: body.value as Prisma.InputJsonValue, description: body.description }
    });
    await writeAuditLog(prisma, {
      actorId: request.auth!.userId,
      action: "system_setting.upsert",
      entityType: "system_settings",
      entityId: setting.id,
      ipAddress: request.ip
    });
    return setting;
  });
}
