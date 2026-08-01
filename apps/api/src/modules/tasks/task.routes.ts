import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseBody, parseParams, parseQuery } from "../../http/validation.js";
import { paginate, paginationSchema } from "../../http/pagination.js";
import { requireAuth, requirePermission } from "../auth/auth.guard.js";
import {
  addTaskComment,
  createTag,
  createTaskCategory,
  createTask,
  deleteTag,
  deleteTaskCategory,
  evaluateTask,
  getTask,
  listTags,
  listTaskCategories,
  listTasks,
  updateTag,
  updateTaskCategory,
  updateTask,
  updateTaskProgress
} from "./task.service.js";
import { prisma } from "../../prisma.js";

const idParamSchema = z.object({ id: z.string().uuid() });

const dateSchema = z.coerce.date().optional();

const createTaskSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  assignerId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  assigneeIds: z.array(z.string().uuid()).default([]),
  followerIds: z.array(z.string().uuid()).default([]),
  departmentId: z.string().uuid().optional(),
  startDate: dateSchema,
  dueDate: dateSchema,
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  categoryId: z.string().uuid().optional(),
  tagIds: z.array(z.string().uuid()).default([]),
  parentTaskId: z.string().uuid().optional(),
  relatedTaskIds: z.array(z.string().uuid()).default([]),
  requiresReview: z.boolean().default(true),
  autoCalculateParentProgress: z.boolean().default(false),
  repeatFrequency: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).default("NONE"),
  customFields: z.record(z.string(), z.unknown()).optional()
});

const updateTaskSchema = createTaskSchema.partial().extend({
  status: z.enum(["DRAFT", "TODO", "IN_PROGRESS", "PAUSED", "PENDING_REVIEW", "DONE", "CANCELLED"]).optional()
});

const taskQuerySchema = paginationSchema.extend({
  keyword: z.string().optional(),
  code: z.string().optional(),
  status: z.enum(["DRAFT", "TODO", "IN_PROGRESS", "PAUSED", "PENDING_REVIEW", "DONE", "CANCELLED"]).optional(),
  assigneeId: z.string().uuid().optional(),
  creatorId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  categoryId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  overdue: z.coerce.boolean().optional(),
  myView: z.enum(["assignee", "assigner", "manager", "follower", "review", "overdue", "done"]).optional()
});

const progressSchema = z.object({
  progress: z.number().int().min(0).max(100),
  note: z.string().optional()
});

const evaluationSchema = z.object({
  accepted: z.boolean(),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().optional(),
  attachmentIds: z.array(z.string().uuid()).default([])
});

const commentSchema = z.object({
  content: z.string().min(1),
  parentCommentId: z.string().uuid().optional(),
  mentions: z.array(z.string().uuid()).default([]),
  attachmentIds: z.array(z.string().uuid()).default([])
});

const taskCategorySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-zA-Z0-9_-]+$/, "Mã danh mục chỉ gồm chữ, số, gạch ngang hoặc gạch dưới."),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).nullable().optional()
});

const tagSchema = z.object({
  name: z.string().trim().min(2).max(80),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Màu nhãn phải có dạng #RRGGBB.")
    .nullable()
    .optional()
});

export async function taskRoutes(app: FastifyInstance) {
  app.get("/task-categories", { preHandler: requireAuth }, async () => listTaskCategories(prisma));
  app.post("/task-categories", { preHandler: requirePermission("task.update_any") }, async (request) => {
    const body = parseBody(request, taskCategorySchema);
    return createTaskCategory(prisma, request.auth!, body, request.ip);
  });
  app.patch("/task-categories/:id", { preHandler: requirePermission("task.update_any") }, async (request) => {
    const params = parseParams(request, idParamSchema);
    const body = parseBody(request, taskCategorySchema.partial());
    return updateTaskCategory(prisma, request.auth!, params.id, body, request.ip);
  });
  app.delete("/task-categories/:id", { preHandler: requirePermission("task.update_any") }, async (request) => {
    const params = parseParams(request, idParamSchema);
    return deleteTaskCategory(prisma, request.auth!, params.id, request.ip);
  });

  app.get("/tags", { preHandler: requireAuth }, async () => listTags(prisma));
  app.post("/tags", { preHandler: requirePermission("task.update_any") }, async (request) => {
    const body = parseBody(request, tagSchema);
    return createTag(prisma, request.auth!, body, request.ip);
  });
  app.patch("/tags/:id", { preHandler: requirePermission("task.update_any") }, async (request) => {
    const params = parseParams(request, idParamSchema);
    const body = parseBody(request, tagSchema.partial());
    return updateTag(prisma, request.auth!, params.id, body, request.ip);
  });
  app.delete("/tags/:id", { preHandler: requirePermission("task.update_any") }, async (request) => {
    const params = parseParams(request, idParamSchema);
    return deleteTag(prisma, request.auth!, params.id, request.ip);
  });

  app.get("/tasks", { preHandler: requireAuth }, async (request) => {
    const query = parseQuery(request, taskQuerySchema);
    const result = await listTasks(prisma, request.auth!, query);
    return paginate(result.data, query.page, query.pageSize, result.total);
  });

  app.post("/tasks", { preHandler: requireAuth }, async (request) => {
    const body = parseBody(request, createTaskSchema);
    return createTask(prisma, request.auth!, body, request.ip);
  });

  app.get("/tasks/:id", { preHandler: requireAuth }, async (request) => {
    const params = parseParams(request, idParamSchema);
    return getTask(prisma, request.auth!, params.id);
  });

  app.patch("/tasks/:id", { preHandler: requireAuth }, async (request) => {
    const params = parseParams(request, idParamSchema);
    const body = parseBody(request, updateTaskSchema);
    return updateTask(prisma, request.auth!, params.id, body, request.ip);
  });

  app.post("/tasks/:id/progress", { preHandler: requireAuth }, async (request) => {
    const params = parseParams(request, idParamSchema);
    const body = parseBody(request, progressSchema);
    return updateTaskProgress(prisma, request.auth!, params.id, body, request.ip);
  });

  app.post("/tasks/:id/evaluations", { preHandler: requireAuth }, async (request) => {
    const params = parseParams(request, idParamSchema);
    const body = parseBody(request, evaluationSchema);
    return evaluateTask(prisma, request.auth!, params.id, body, request.ip);
  });

  app.post("/tasks/:id/comments", { preHandler: requireAuth }, async (request) => {
    const params = parseParams(request, idParamSchema);
    const body = parseBody(request, commentSchema);
    return addTaskComment(prisma, request.auth!, params.id, body, request.ip);
  });
}
