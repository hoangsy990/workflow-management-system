import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { parseBody, parseParams } from "../../http/validation.js";
import { requireAuth } from "./auth.guard.js";
import { getUserAuthContext, listAuthSessions, login, logout, refreshAccessToken, revokeAllAuthSessions, revokeAuthSession } from "./auth.service.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceName: z.string().optional()
});

const refreshSchema = z.object({
  refreshToken: z.string().min(16)
});
const sessionParamSchema = z.object({ id: z.string().uuid() });

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } }
  }, async (request) => {
    const body = parseBody(request, loginSchema);
    return login(prisma, app, {
      ...body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]
    });
  });

  app.post("/auth/refresh", async (request) => {
    const body = parseBody(request, refreshSchema);
    return refreshAccessToken(prisma, app, body.refreshToken);
  });

  app.post("/auth/logout", { preHandler: requireAuth }, async (request) => {
    const body = parseBody(request, refreshSchema.partial());
    await logout(prisma, request.auth!.userId, body.refreshToken);
    return { ok: true };
  });

  app.post("/auth/logout-all", { preHandler: requireAuth }, async (request) => {
    await revokeAllAuthSessions(prisma, request.auth!.userId, request.ip);
    return { ok: true };
  });

  app.get("/auth/sessions", { preHandler: requireAuth }, async (request) => {
    return listAuthSessions(prisma, request.auth!.userId);
  });

  app.delete("/auth/sessions/:id", { preHandler: requireAuth }, async (request) => {
    const params = parseParams(request, sessionParamSchema);
    await revokeAuthSession(prisma, request.auth!.userId, params.id, request.ip);
    return { ok: true };
  });

  app.get("/auth/me", { preHandler: requireAuth }, async (request) => {
    return getUserAuthContext(prisma, request.auth!.userId);
  });
}
