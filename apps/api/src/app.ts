import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import { config } from "./config.js";
import { registerErrorHandler } from "./http/errors.js";
import { prisma } from "./prisma.js";
import { auditRoutes } from "./modules/audit/audit.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { identityRoutes } from "./modules/identity/identity.routes.js";
import { notificationRoutes } from "./modules/notifications/notification.routes.js";
import { settingsRoutes } from "./modules/settings/settings.routes.js";
import { taskRoutes } from "./modules/tasks/task.routes.js";
import { uploadRoutes } from "./modules/uploads/upload.routes.js";
import { workflowRoutes } from "./modules/workflows/workflow.routes.js";

export async function createApp() {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "production" ? "info" : "debug"
    }
  });

  app.setErrorHandler(registerErrorHandler());

  await app.register(helmet, {
    contentSecurityPolicy: false
  });
  await app.register(cors, {
    origin: [config.WEB_ORIGIN, "http://localhost:8080"],
    credentials: false,
    exposedHeaders: ["Content-Disposition"]
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute"
  });
  await app.register(jwt, {
    secret: config.JWT_ACCESS_SECRET
  });
  await app.register(multipart, {
    attachFieldsToBody: false,
    limits: {
      fileSize: config.MAX_UPLOAD_MB * 1024 * 1024,
      files: 10
    }
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "WorkFlow Management System API",
        description: "API v1 dùng chung cho web, Windows, Android và iOS.",
        version: "0.1.0"
      },
      servers: [{ url: "/api/v1" }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
          }
        }
      }
    }
  });
  await app.register(swaggerUi, {
    routePrefix: "/docs"
  });

  app.get("/health", async () => {
    await prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      service: "workflow-api",
      timezone: "Asia/Ho_Chi_Minh",
      timestamp: new Date().toISOString()
    };
  });

  await app.register(async (api) => {
    await api.register(authRoutes);
    await api.register(identityRoutes);
    await api.register(taskRoutes);
    await api.register(uploadRoutes);
    await api.register(workflowRoutes);
    await api.register(notificationRoutes);
    await api.register(dashboardRoutes);
    await api.register(auditRoutes);
    await api.register(settingsRoutes);
  }, { prefix: "/api/v1" });

  return app;
}
