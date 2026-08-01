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

const sensitiveSettingPattern = /(password|secret|token|credential|api[_-]?key)/i;

function auditSettingValue(key: string, value: unknown): Prisma.InputJsonValue {
  if (sensitiveSettingPattern.test(key)) {
    return "[REDACTED]";
  }
  return value as Prisma.InputJsonValue;
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get("/system-settings", { preHandler: requireAuth }, async () => {
    return prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
  });

  app.put("/system-settings", { preHandler: requirePermission("setting.manage") }, async (request) => {
    const body = parseBody(request, settingSchema);
    return prisma.$transaction(async (tx) => {
      const previous = await tx.systemSetting.findUnique({ where: { key: body.key } });
      const setting = await tx.systemSetting.upsert({
        where: { key: body.key },
        update: { value: body.value as Prisma.InputJsonValue, description: body.description },
        create: { key: body.key, value: body.value as Prisma.InputJsonValue, description: body.description }
      });
      await writeAuditLog(tx, {
        actorId: request.auth!.userId,
        action: "system_setting.upsert",
        entityType: "system_settings",
        entityId: setting.id,
        ipAddress: request.ip,
        metadata: {
          key: body.key,
          operation: previous ? "update" : "create",
          previousValue: previous ? auditSettingValue(body.key, previous.value) : null,
          nextValue: auditSettingValue(body.key, body.value),
          previousDescription: previous?.description ?? null,
          nextDescription: body.description ?? previous?.description ?? null
        }
      });
      return setting;
    });
  });
}
