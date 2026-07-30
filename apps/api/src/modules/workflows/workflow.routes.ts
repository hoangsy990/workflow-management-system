import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { paginate, paginationSchema } from "../../http/pagination.js";
import { parseBody, parseParams, parseQuery } from "../../http/validation.js";
import { requireAuth } from "../auth/auth.guard.js";
import {
  actOnWorkflowInstance,
  compareWorkflowVersions,
  createWorkflowTemplate,
  getWorkflowInstance,
  getWorkflowTemplate,
  listWorkflowInstances,
  listWorkflowTemplates,
  submitWorkflowInstance,
  updateWorkflowVersionStatus
} from "./workflow.service.js";

const idParamSchema = z.object({ id: z.string().uuid() });
const compareParamSchema = z.object({ leftId: z.string().uuid(), rightId: z.string().uuid() });

const fieldValidationSchema = z
  .object({
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(1).optional(),
    min: z.number().optional(),
    max: z.number().optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.minLength !== undefined && value.maxLength !== undefined && value.minLength > value.maxLength) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minLength"],
        message: "Độ dài tối thiểu không được lớn hơn độ dài tối đa."
      });
    }
    if (value.min !== undefined && value.max !== undefined && value.min > value.max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["min"],
        message: "Giá trị tối thiểu không được lớn hơn giá trị tối đa."
      });
    }
  });

const fieldSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  type: z.enum([
    "SHORT_TEXT",
    "LONG_TEXT",
    "NUMBER",
    "CURRENCY",
    "DATE",
    "DATETIME",
    "CHECKBOX",
    "RADIO",
    "SELECT",
    "USER_SELECT",
    "DEPARTMENT_SELECT",
    "ATTACHMENT",
    "TABLE",
    "HEADING"
  ]),
  isRequired: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
  placeholder: z.string().optional(),
  validation: fieldValidationSchema.optional(),
  displayOrder: z.number().int().optional(),
  editableBySteps: z.unknown().optional(),
  visibleToRoles: z.unknown().optional()
});

const assigneeSchema = z.object({
  resolverType: z.enum([
    "SPECIFIC_USER",
    "ROLE",
    "DEPARTMENT",
    "REQUESTER_DEPARTMENT_HEAD",
    "REQUESTER_MANAGER",
    "FORM_FIELD_USER",
    "PREVIOUS_STEP_ASSIGNEE"
  ]),
  userId: z.string().uuid().optional(),
  roleId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  formFieldCode: z.string().optional(),
  orderIndex: z.number().int().optional()
});

const stepSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["START", "HANDLER", "APPROVAL", "REVIEW", "NOTIFICATION", "END"]),
  orderIndex: z.number().int(),
  approvalMode: z.enum(["SEQUENTIAL", "PARALLEL"]).optional(),
  completionRule: z.enum(["ALL", "ANY", "MIN_COUNT", "MIN_PERCENT"]).optional(),
  minCount: z.number().int().optional(),
  minPercent: z.number().int().min(1).max(100).optional(),
  deadlineAmount: z.number().int().optional(),
  deadlineUnit: z.string().optional(),
  countWeekend: z.boolean().optional(),
  reminderBeforeHours: z.number().int().optional(),
  assignees: z.array(assigneeSchema).default([])
});

const transitionSchema = z.object({
  fromStepCode: z.string().min(1),
  toStepCode: z.string().min(1),
  name: z.string().optional(),
  priority: z.number().int().optional(),
  conditions: z
    .array(
      z.object({
        fieldCode: z.string().min(1),
        operator: z.string().min(1),
        compareValue: z.unknown(),
        groupType: z.enum(["AND", "OR"]).optional()
      })
    )
    .default([])
});

const createTemplateSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.string().optional(),
  managerId: z.string().uuid().optional(),
  activate: z.boolean().default(true),
  fields: z.array(fieldSchema),
  steps: z.array(stepSchema).min(2),
  transitions: z.array(transitionSchema)
});

const submitSchema = z.object({
  templateId: z.string().uuid(),
  formData: z.record(z.string(), z.unknown()),
  idempotencyKey: z.string().min(8).optional()
});

const instanceQuerySchema = paginationSchema.extend({
  status: z
    .enum(["DRAFT", "SUBMITTED", "IN_PROGRESS", "NEEDS_INFO", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED"])
    .optional(),
  pendingMine: z.coerce.boolean().optional()
});

const actionSchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT", "REQUEST_INFO", "RETURN", "TRANSFER"]),
    comment: z.string().optional(),
    transferToUserId: z.string().uuid().optional(),
    attachmentIds: z.array(z.string().uuid()).default([]),
    idempotencyKey: z.string().min(8).optional()
  })
  .superRefine((value, ctx) => {
    if (value.action === "TRANSFER" && !value.transferToUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["transferToUserId"],
        message: "Người nhận chuyển xử lý là bắt buộc."
      });
    }
  });

const statusSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"])
});

export async function workflowRoutes(app: FastifyInstance) {
  app.get("/workflow-templates", { preHandler: requireAuth }, async () => listWorkflowTemplates(prisma));

  app.post("/workflow-templates", { preHandler: requireAuth }, async (request) => {
    const body = parseBody(request, createTemplateSchema);
    return createWorkflowTemplate(prisma, request.auth!, body, request.ip);
  });

  app.get("/workflow-templates/:id", { preHandler: requireAuth }, async (request) => {
    const params = parseParams(request, idParamSchema);
    return getWorkflowTemplate(prisma, params.id);
  });

  app.patch("/workflow-versions/:id/status", { preHandler: requireAuth }, async (request) => {
    const params = parseParams(request, idParamSchema);
    const body = parseBody(request, statusSchema);
    return updateWorkflowVersionStatus(prisma, request.auth!, params.id, body.status, request.ip);
  });

  app.get("/workflow-versions/:leftId/compare/:rightId", { preHandler: requireAuth }, async (request) => {
    const params = parseParams(request, compareParamSchema);
    return compareWorkflowVersions(prisma, params.leftId, params.rightId);
  });

  app.get("/workflow-instances", { preHandler: requireAuth }, async (request) => {
    const query = parseQuery(request, instanceQuerySchema);
    const result = await listWorkflowInstances(prisma, request.auth!, query);
    return paginate(result.data, query.page, query.pageSize, result.total);
  });

  app.post("/workflow-instances", { preHandler: requireAuth }, async (request) => {
    const body = parseBody(request, submitSchema);
    return submitWorkflowInstance(prisma, request.auth!, body, request.ip);
  });

  app.get("/workflow-instances/:id", { preHandler: requireAuth }, async (request) => {
    const params = parseParams(request, idParamSchema);
    return getWorkflowInstance(prisma, request.auth!, params.id);
  });

  app.post("/workflow-instances/:id/actions", { preHandler: requireAuth }, async (request) => {
    const params = parseParams(request, idParamSchema);
    const body = parseBody(request, actionSchema);
    return actOnWorkflowInstance(prisma, request.auth!, params.id, body, request.ip);
  });
}
