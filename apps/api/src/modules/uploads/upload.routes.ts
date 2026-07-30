import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import { config } from "../../config.js";
import { badRequest, forbidden, notFound } from "../../http/errors.js";
import { parseParams } from "../../http/validation.js";
import { prisma } from "../../prisma.js";
import { requireAuth } from "../auth/auth.guard.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { visibleTaskWhere } from "../tasks/task.service.js";
import { ensureCanReadWorkflowInstance, ensureCanUploadWorkflowAttachment } from "../workflows/workflow.service.js";

const taskParamSchema = z.object({ id: z.string().uuid() });
const attachmentParamSchema = z.object({ id: z.string().uuid() });
const avatarParamSchema = z.object({
  userId: z.string().uuid(),
  filename: z.string().regex(/^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/i)
});

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "video/mp4"
]);
const avatarMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const avatarExtensionByMime: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

function safeOriginalName(filename: string) {
  return path.basename(filename).replace(/[^\w.\- ()]/g, "_").slice(0, 180);
}

async function ensureTaskVisible(taskId: string, userId: string, authWhere: Awaited<ReturnType<typeof visibleTaskWhere>>) {
  const count = await prisma.task.count({ where: { id: taskId, ...authWhere } });
  if (count === 0) {
    throw forbidden("Bạn không có quyền thao tác với công việc này.");
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } }
  });
  const permissions =
    user?.roles.flatMap((role) => role.role.permissions.map((permission) => permission.permission.code)) ?? [];
  if (!permissions.includes("task.comment") && !permissions.includes("task.update_any")) {
    throw forbidden("Bạn không có quyền tải tệp lên công việc này.");
  }
}

export async function uploadRoutes(app: FastifyInstance) {
  app.get("/avatars/:userId/:filename", async (request, reply) => {
    const params = parseParams(request, avatarParamSchema);
    const avatarUrl = `/api/v1/avatars/${params.userId}/${params.filename}`;
    const user = await prisma.user.findFirst({
      where: { id: params.userId, avatarUrl, deletedAt: null },
      select: { id: true }
    });
    if (!user) {
      throw notFound("Không tìm thấy ảnh đại diện.");
    }

    const storageKey = path.posix.join("avatars", params.userId, params.filename);
    const absolutePath = path.resolve(config.UPLOAD_DIR, storageKey);
    const uploadRoot = path.resolve(config.UPLOAD_DIR);
    if (!absolutePath.startsWith(uploadRoot + path.sep)) {
      throw forbidden("Đường dẫn tệp không hợp lệ.");
    }

    let fileStat;
    try {
      fileStat = await stat(absolutePath);
    } catch {
      throw notFound("Không tìm thấy ảnh đại diện.");
    }

    const extension = path.extname(params.filename).toLowerCase();
    const mimeType = extension === ".webp" ? "image/webp" : extension === ".png" ? "image/png" : "image/jpeg";
    reply.type(mimeType);
    reply.header("Content-Length", fileStat.size);
    return reply.send(createReadStream(absolutePath));
  });

  app.post("/profile/avatar", { preHandler: requireAuth }, async (request) => {
    const file = await request.file({
      limits: { fileSize: Math.min(config.MAX_UPLOAD_MB, 5) * 1024 * 1024 }
    });
    if (!file) {
      throw badRequest("Vui lòng chọn ảnh đại diện.");
    }
    if (!avatarMimeTypes.has(file.mimetype)) {
      throw badRequest("Ảnh đại diện chỉ hỗ trợ JPG, PNG hoặc WebP.");
    }

    const originalName = safeOriginalName(file.filename);
    const storedName = `${nanoid(24)}${avatarExtensionByMime[file.mimetype]}`;
    const relativeKey = path.posix.join("avatars", request.auth!.userId, storedName);
    const avatarUrl = `/api/v1/avatars/${request.auth!.userId}/${storedName}`;
    const absoluteDir = path.resolve(config.UPLOAD_DIR, "avatars", request.auth!.userId);
    const absolutePath = path.join(absoluteDir, storedName);

    await mkdir(absoluteDir, { recursive: true });
    await pipeline(file.file, createWriteStream(absolutePath));
    const fileStat = await stat(absolutePath);

    await prisma.user.update({
      where: { id: request.auth!.userId },
      data: { avatarUrl }
    });

    await writeAuditLog(prisma, {
      actorId: request.auth!.userId,
      action: "user.avatar.upload",
      entityType: "users",
      entityId: request.auth!.userId,
      ipAddress: request.ip,
      metadata: { originalName, sizeBytes: fileStat.size, mimeType: file.mimetype, storageKey: relativeKey }
    });

    return {
      avatarUrl,
      originalName,
      mimeType: file.mimetype,
      sizeBytes: fileStat.size
    };
  });

  app.post("/tasks/:id/attachments", { preHandler: requireAuth }, async (request) => {
    const params = parseParams(request, taskParamSchema);
    const authWhere = await visibleTaskWhere(prisma, request.auth!);
    await ensureTaskVisible(params.id, request.auth!.userId, authWhere);

    const file = await request.file({
      limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024 }
    });
    if (!file) {
      throw badRequest("Vui lòng chọn tệp cần tải lên.");
    }
    if (!allowedMimeTypes.has(file.mimetype)) {
      throw badRequest("Định dạng tệp không được hỗ trợ.");
    }

    const originalName = safeOriginalName(file.filename);
    const extension = path.extname(originalName).toLowerCase();
    const storedName = `${nanoid(24)}${extension}`;
    const relativeKey = path.posix.join("tasks", params.id, storedName);
    const absoluteDir = path.resolve(config.UPLOAD_DIR, "tasks", params.id);
    const absolutePath = path.join(absoluteDir, storedName);

    await mkdir(absoluteDir, { recursive: true });
    await pipeline(file.file, createWriteStream(absolutePath));
    const fileStat = await stat(absolutePath);

    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId: params.id,
        uploadedById: request.auth!.userId,
        originalName,
        storedName,
        mimeType: file.mimetype,
        sizeBytes: fileStat.size,
        storageKey: relativeKey
      },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true
      }
    });

    await writeAuditLog(prisma, {
      actorId: request.auth!.userId,
      action: "task.attachment.upload",
      entityType: "task_attachments",
      entityId: attachment.id,
      ipAddress: request.ip,
      metadata: { taskId: params.id, originalName, sizeBytes: fileStat.size }
    });

    return attachment;
  });

  app.post("/workflow-instances/:id/attachments", { preHandler: requireAuth }, async (request) => {
    const params = parseParams(request, taskParamSchema);
    await ensureCanUploadWorkflowAttachment(prisma, request.auth!, params.id);

    const file = await request.file({
      limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024 }
    });
    if (!file) {
      throw badRequest("Vui lòng chọn tệp cần tải lên.");
    }
    if (!allowedMimeTypes.has(file.mimetype)) {
      throw badRequest("Định dạng tệp không được hỗ trợ.");
    }

    const originalName = safeOriginalName(file.filename);
    const extension = path.extname(originalName).toLowerCase();
    const storedName = `${nanoid(24)}${extension}`;
    const relativeKey = path.posix.join("workflows", params.id, storedName);
    const absoluteDir = path.resolve(config.UPLOAD_DIR, "workflows", params.id);
    const absolutePath = path.join(absoluteDir, storedName);

    await mkdir(absoluteDir, { recursive: true });
    await pipeline(file.file, createWriteStream(absolutePath));
    const fileStat = await stat(absolutePath);

    const attachment = await prisma.workflowAttachment.create({
      data: {
        instanceId: params.id,
        uploadedById: request.auth!.userId,
        originalName,
        storedName,
        mimeType: file.mimetype,
        sizeBytes: fileStat.size,
        storageKey: relativeKey
      },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true
      }
    });

    await writeAuditLog(prisma, {
      actorId: request.auth!.userId,
      action: "workflow.attachment.upload",
      entityType: "workflow_attachments",
      entityId: attachment.id,
      ipAddress: request.ip,
      metadata: { instanceId: params.id, originalName, sizeBytes: fileStat.size }
    });

    return attachment;
  });

  app.get("/attachments/:id/download", { preHandler: requireAuth }, async (request, reply) => {
    const params = parseParams(request, attachmentParamSchema);
    const attachment = await prisma.taskAttachment.findUnique({
      where: { id: params.id },
      include: { task: true }
    });
    if (!attachment || attachment.deletedAt || attachment.task.deletedAt) {
      throw notFound("Không tìm thấy tệp đính kèm.");
    }
    const authWhere = await visibleTaskWhere(prisma, request.auth!);
    const visible = await prisma.task.count({ where: { id: attachment.taskId, ...authWhere } });
    if (visible === 0) {
      throw forbidden("Bạn không có quyền tải tệp này.");
    }

    const absolutePath = path.resolve(config.UPLOAD_DIR, attachment.storageKey);
    await writeAuditLog(prisma, {
      actorId: request.auth!.userId,
      action: "task.attachment.download",
      entityType: "task_attachments",
      entityId: attachment.id,
      ipAddress: request.ip,
      metadata: { taskId: attachment.taskId, originalName: attachment.originalName, sizeBytes: attachment.sizeBytes }
    });

    reply
      .type(attachment.mimeType)
      .header("Content-Disposition", `attachment; filename="${encodeURIComponent(attachment.originalName)}"`);
    return reply.send(createReadStream(absolutePath));
  });

  app.get("/workflow-attachments/:id/download", { preHandler: requireAuth }, async (request, reply) => {
    const params = parseParams(request, attachmentParamSchema);
    const attachment = await prisma.workflowAttachment.findUnique({
      where: { id: params.id },
      include: { instance: true }
    });
    if (!attachment || attachment.deletedAt || attachment.instance.deletedAt) {
      throw notFound("Không tìm thấy tệp đính kèm.");
    }

    await ensureCanReadWorkflowInstance(prisma, request.auth!, attachment.instanceId);

    const absolutePath = path.resolve(config.UPLOAD_DIR, attachment.storageKey);
    await writeAuditLog(prisma, {
      actorId: request.auth!.userId,
      action: "workflow.attachment.download",
      entityType: "workflow_attachments",
      entityId: attachment.id,
      ipAddress: request.ip,
      metadata: { instanceId: attachment.instanceId, originalName: attachment.originalName, sizeBytes: attachment.sizeBytes }
    });

    reply
      .type(attachment.mimeType)
      .header("Content-Disposition", `attachment; filename="${encodeURIComponent(attachment.originalName)}"`);
    return reply.send(createReadStream(absolutePath));
  });
}
