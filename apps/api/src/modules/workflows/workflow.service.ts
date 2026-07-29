import type {
  ApprovalStatus,
  Prisma,
  PrismaClient,
  WorkflowAction,
  WorkflowStep,
  WorkflowVersionStatus
} from "@prisma/client";
import type { AuthContext } from "../../types/fastify.js";
import { badRequest, conflict, forbidden, notFound } from "../../http/errors.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { enqueueNotifications } from "../notifications/notification.service.js";
import { assertWorkflowVersionEditable, evaluateConditions, isStepComplete, validateWorkflowFormData } from "./workflow.domain.js";

type Db = PrismaClient | Prisma.TransactionClient;
type StepWithAssignees = Prisma.WorkflowStepGetPayload<{ include: { assignees: true } }>;
type TransitionWithConditions = Prisma.WorkflowTransitionGetPayload<{
  include: { conditions: true; toStep: { include: { assignees: true } } };
}>;

export interface WorkflowFieldInput {
  name: string;
  code: string;
  type: string;
  isRequired?: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  validation?: unknown;
  displayOrder?: number;
  editableBySteps?: unknown;
  visibleToRoles?: unknown;
}

export interface WorkflowStepInput {
  code: string;
  name: string;
  type: string;
  orderIndex: number;
  approvalMode?: "SEQUENTIAL" | "PARALLEL";
  completionRule?: "ALL" | "ANY" | "MIN_COUNT" | "MIN_PERCENT";
  minCount?: number;
  minPercent?: number;
  deadlineAmount?: number;
  deadlineUnit?: string;
  countWeekend?: boolean;
  reminderBeforeHours?: number;
  assignees?: Array<{
    resolverType: string;
    userId?: string;
    roleId?: string;
    departmentId?: string;
    formFieldCode?: string;
    orderIndex?: number;
  }>;
}

export interface WorkflowTransitionInput {
  fromStepCode: string;
  toStepCode: string;
  name?: string;
  priority?: number;
  conditions?: Array<{
    fieldCode: string;
    operator: string;
    compareValue: unknown;
    groupType?: "AND" | "OR";
  }>;
}

export interface CreateWorkflowTemplateInput {
  code: string;
  name: string;
  description?: string;
  category?: string;
  managerId?: string;
  activate?: boolean;
  fields: WorkflowFieldInput[];
  steps: WorkflowStepInput[];
  transitions: WorkflowTransitionInput[];
}

function hasPermission(auth: AuthContext, permission: string): boolean {
  return auth.permissions.includes(permission);
}

function dateCodePrefix(prefix: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${prefix}-${year}${month}${day}`;
}

async function generateInstanceCode(db: Db) {
  const prefix = dateCodePrefix("WF");
  const count = await db.workflowInstance.count({ where: { code: { startsWith: prefix } } });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function resolveStepAssignees(
  db: Db,
  step: StepWithAssignees,
  input: {
    requesterId: string;
    formData: Record<string, unknown>;
    previousApproverIds?: string[];
  }
): Promise<string[]> {
  const ids: string[] = [];
  const requester = await db.user.findUnique({
    where: { id: input.requesterId },
    include: {
      department: { select: { managerId: true } },
      manager: { select: { id: true } }
    }
  });

  for (const rule of [...step.assignees].sort((a, b) => a.orderIndex - b.orderIndex)) {
    if (rule.resolverType === "SPECIFIC_USER" && rule.userId) {
      ids.push(rule.userId);
    }

    if (rule.resolverType === "ROLE" && rule.roleId) {
      const users = await db.user.findMany({
        where: { roles: { some: { roleId: rule.roleId } }, status: "ACTIVE", deletedAt: null },
        select: { id: true }
      });
      ids.push(...users.map((user) => user.id));
    }

    if (rule.resolverType === "DEPARTMENT" && rule.departmentId) {
      const users = await db.user.findMany({
        where: { departmentId: rule.departmentId, status: "ACTIVE", deletedAt: null },
        select: { id: true }
      });
      ids.push(...users.map((user) => user.id));
    }

    if (rule.resolverType === "REQUESTER_MANAGER" && requester?.manager?.id) {
      ids.push(requester.manager.id);
    }

    if (rule.resolverType === "REQUESTER_DEPARTMENT_HEAD" && requester?.department?.managerId) {
      ids.push(requester.department.managerId);
    }

    if (rule.resolverType === "FORM_FIELD_USER" && rule.formFieldCode) {
      const value = input.formData[rule.formFieldCode];
      if (Array.isArray(value)) {
        ids.push(...value.filter((item): item is string => typeof item === "string"));
      } else if (typeof value === "string") {
        ids.push(value);
      }
    }

    if (rule.resolverType === "PREVIOUS_STEP_ASSIGNEE") {
      ids.push(...(input.previousApproverIds ?? []));
    }
  }

  return [...new Set(ids)];
}

async function startStep(
  tx: Prisma.TransactionClient,
  instanceId: string,
  step: StepWithAssignees,
  input: {
    requesterId: string;
    formData: Record<string, unknown>;
    previousApproverIds?: string[];
  }
) {
  const instanceStep = await tx.workflowInstanceStep.create({
    data: {
      instanceId,
      stepId: step.id,
      status: "PENDING",
      startedAt: new Date()
    }
  });

  const assigneeIds = await resolveStepAssignees(tx, step, input);
  const pendingIds = step.approvalMode === "SEQUENTIAL" ? assigneeIds.slice(0, 1) : assigneeIds;

  if (pendingIds.length > 0) {
    await tx.workflowApproval.createMany({
      data: pendingIds.map((approverId) => ({
        instanceId,
        instanceStepId: instanceStep.id,
        stepId: step.id,
        approverId,
        status: "PENDING"
      })),
      skipDuplicates: true
    });
  }

  await enqueueNotifications(
    tx,
    pendingIds.map((userId) => ({
      userId,
      title: "Có yêu cầu phê duyệt mới",
      content: step.name,
      type: "WORKFLOW_APPROVAL_PENDING",
      objectType: "workflow_instance",
      objectId: instanceId,
      link: `/workflows/instances/${instanceId}`
    }))
  );

  return { instanceStep, assigneeIds };
}

async function pickNextTransition(
  transitions: TransitionWithConditions[],
  fromStepId: string,
  formData: Record<string, unknown>
) {
  const candidates = transitions
    .filter((transition) => transition.fromStepId === fromStepId)
    .sort((a, b) => a.priority - b.priority);

  for (const transition of candidates) {
    const conditions = transition.conditions.map((condition) => ({
      fieldCode: condition.fieldCode,
      operator: condition.operator,
      compareValue: condition.compareValue,
      groupType: condition.groupType
    }));
    if (evaluateConditions(conditions, formData)) {
      return transition;
    }
  }

  return null;
}

export async function listWorkflowTemplates(db: PrismaClient) {
  return db.workflowTemplate.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      manager: { select: { id: true, fullName: true } },
      versions: {
        orderBy: { versionNo: "desc" },
        take: 3,
        include: { _count: { select: { instances: true, steps: true, fields: true } } }
      }
    }
  });
}

export async function getWorkflowTemplate(db: PrismaClient, id: string) {
  const template = await db.workflowTemplate.findUnique({
    where: { id },
    include: {
      manager: { select: { id: true, fullName: true } },
      versions: {
        orderBy: { versionNo: "desc" },
        include: {
          fields: { orderBy: { displayOrder: "asc" } },
          steps: { orderBy: { orderIndex: "asc" }, include: { assignees: true } },
          transitions: { include: { conditions: true, fromStep: true, toStep: true } },
          _count: { select: { instances: true } }
        }
      }
    }
  });

  if (!template || template.deletedAt) {
    throw notFound("Không tìm thấy mẫu quy trình.");
  }

  return template;
}

export async function createWorkflowTemplate(
  db: PrismaClient,
  auth: AuthContext,
  input: CreateWorkflowTemplateInput,
  ipAddress?: string
) {
  if (!hasPermission(auth, "workflow.template.manage")) {
    throw forbidden();
  }

  const existing = await db.workflowTemplate.findUnique({ where: { code: input.code } });
  if (existing) {
    throw conflict("Mã quy trình đã tồn tại.");
  }

  if (input.steps.length < 2) {
    throw badRequest("Quy trình cần ít nhất bước bắt đầu và kết thúc hoặc một bước xử lý.");
  }

  return db.$transaction(async (tx) => {
    const template = await tx.workflowTemplate.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        category: input.category,
        managerId: input.managerId,
        status: "ACTIVE"
      }
    });

    const version = await tx.workflowVersion.create({
      data: {
        templateId: template.id,
        versionNo: 1,
        status: input.activate ? "ACTIVE" : "DRAFT",
        activatedAt: input.activate ? new Date() : null,
        createdById: auth.userId,
        formSchema: { fields: input.fields } as unknown as Prisma.InputJsonValue
      }
    });

    await tx.workflowFormField.createMany({
      data: input.fields.map((field) => ({
        versionId: version.id,
        name: field.name,
        code: field.code,
        type: field.type as never,
        isRequired: field.isRequired ?? false,
        defaultValue: field.defaultValue as Prisma.InputJsonValue | undefined,
        placeholder: field.placeholder,
        validation: field.validation as Prisma.InputJsonValue | undefined,
        displayOrder: field.displayOrder ?? 0,
        editableBySteps: field.editableBySteps as Prisma.InputJsonValue | undefined,
        visibleToRoles: field.visibleToRoles as Prisma.InputJsonValue | undefined
      }))
    });

    const stepMap = new Map<string, WorkflowStep>();
    for (const stepInput of input.steps) {
      const step = await tx.workflowStep.create({
        data: {
          versionId: version.id,
          code: stepInput.code,
          name: stepInput.name,
          type: stepInput.type as never,
          orderIndex: stepInput.orderIndex,
          approvalMode: stepInput.approvalMode ?? "SEQUENTIAL",
          completionRule: stepInput.completionRule ?? "ALL",
          minCount: stepInput.minCount,
          minPercent: stepInput.minPercent,
          deadlineAmount: stepInput.deadlineAmount,
          deadlineUnit: stepInput.deadlineUnit,
          countWeekend: stepInput.countWeekend ?? true,
          reminderBeforeHours: stepInput.reminderBeforeHours
        }
      });
      stepMap.set(stepInput.code, step);

      if (stepInput.assignees?.length) {
        await tx.workflowStepAssignee.createMany({
          data: stepInput.assignees.map((assignee) => ({
            stepId: step.id,
            resolverType: assignee.resolverType as never,
            userId: assignee.userId,
            roleId: assignee.roleId,
            departmentId: assignee.departmentId,
            formFieldCode: assignee.formFieldCode,
            orderIndex: assignee.orderIndex ?? 0
          }))
        });
      }
    }

    for (const transitionInput of input.transitions) {
      const fromStep = stepMap.get(transitionInput.fromStepCode);
      const toStep = stepMap.get(transitionInput.toStepCode);
      if (!fromStep || !toStep) {
        throw badRequest("Transition tham chiếu bước không tồn tại.");
      }
      const transition = await tx.workflowTransition.create({
        data: {
          versionId: version.id,
          fromStepId: fromStep.id,
          toStepId: toStep.id,
          name: transitionInput.name,
          priority: transitionInput.priority ?? 0
        }
      });

      if (transitionInput.conditions?.length) {
        await tx.workflowCondition.createMany({
          data: transitionInput.conditions.map((condition) => ({
            transitionId: transition.id,
            fieldCode: condition.fieldCode,
            operator: condition.operator,
            compareValue: condition.compareValue as Prisma.InputJsonValue,
            groupType: condition.groupType ?? "AND"
          }))
        });
      }
    }

    await writeAuditLog(tx, {
      actorId: auth.userId,
      action: "workflow.template.create",
      entityType: "workflow_templates",
      entityId: template.id,
      ipAddress
    });

    return tx.workflowTemplate.findUniqueOrThrow({
      where: { id: template.id },
      include: {
        manager: { select: { id: true, fullName: true } },
        versions: {
          orderBy: { versionNo: "desc" },
          include: {
            fields: { orderBy: { displayOrder: "asc" } },
            steps: { orderBy: { orderIndex: "asc" }, include: { assignees: true } },
            transitions: { include: { conditions: true, fromStep: true, toStep: true } },
            _count: { select: { instances: true } }
          }
        }
      }
    });
  });
}

export async function updateWorkflowVersionStatus(
  db: PrismaClient,
  auth: AuthContext,
  versionId: string,
  status: WorkflowVersionStatus,
  ipAddress?: string
) {
  if (!hasPermission(auth, "workflow.template.manage")) {
    throw forbidden();
  }

  const version = await db.workflowVersion.findUnique({
    where: { id: versionId },
    include: { _count: { select: { instances: true } } }
  });
  if (!version) {
    throw notFound("Không tìm thấy phiên bản quy trình.");
  }
  if (status === "DRAFT") {
    assertWorkflowVersionEditable({ status: version.status, instanceCount: version._count.instances });
  }

  return db.$transaction(async (tx) => {
    if (status === "ACTIVE") {
      await tx.workflowVersion.updateMany({
        where: { templateId: version.templateId, status: "ACTIVE", id: { not: versionId } },
        data: { status: "ARCHIVED" }
      });
    }

    const updated = await tx.workflowVersion.update({
      where: { id: versionId },
      data: {
        status,
        activatedAt: status === "ACTIVE" ? new Date() : version.activatedAt,
        version: { increment: 1 }
      }
    });

    await writeAuditLog(tx, {
      actorId: auth.userId,
      action: "workflow.version.status.update",
      entityType: "workflow_versions",
      entityId: versionId,
      ipAddress,
      metadata: { status }
    });

    return updated;
  });
}

export async function submitWorkflowInstance(
  db: PrismaClient,
  auth: AuthContext,
  input: { templateId: string; formData: Record<string, unknown>; idempotencyKey?: string },
  ipAddress?: string
) {
  if (!hasPermission(auth, "workflow.instance.create")) {
    throw forbidden();
  }

  const scope = `workflow.submit:${input.templateId}`;
  if (input.idempotencyKey) {
    const existing = await db.idempotencyKey.findUnique({
      where: { userId_key_scope: { userId: auth.userId, key: input.idempotencyKey, scope } }
    });
    if (existing?.response) {
      return existing.response;
    }
  }

  const version = await db.workflowVersion.findFirst({
    where: { templateId: input.templateId, status: "ACTIVE" },
    orderBy: { versionNo: "desc" },
    include: {
      template: true,
      fields: { orderBy: { displayOrder: "asc" } },
      steps: { orderBy: { orderIndex: "asc" }, include: { assignees: true } },
      transitions: { include: { conditions: true, toStep: { include: { assignees: true } } } }
    }
  });

  if (!version) {
    throw badRequest("Mẫu quy trình chưa có phiên bản đang hoạt động.");
  }

  const formErrors = validateWorkflowFormData(version.fields, input.formData);
  if (formErrors.length > 0) {
    throw badRequest(formErrors[0]!);
  }

  const firstStep = version.steps.find((step) => step.type !== "START");
  if (!firstStep) {
    throw badRequest("Quy trình chưa có bước xử lý.");
  }

  return db.$transaction(async (tx) => {
    const instance = await tx.workflowInstance.create({
      data: {
        code: await generateInstanceCode(tx),
        templateId: version.templateId,
        versionId: version.id,
        requesterId: auth.userId,
        currentStepId: firstStep.id,
        status: "IN_PROGRESS",
        formData: input.formData as Prisma.InputJsonValue,
        submittedAt: new Date(),
        values: {
          createMany: {
            data: version.fields.map((field) => ({
              fieldId: field.id,
              fieldCode: field.code,
              value: (input.formData[field.code] ?? null) as Prisma.InputJsonValue
            }))
          }
        }
      }
    });

    await startStep(tx, instance.id, firstStep, {
      requesterId: auth.userId,
      formData: input.formData
    });

    await writeAuditLog(tx, {
      actorId: auth.userId,
      action: "workflow.instance.submit",
      entityType: "workflow_instances",
      entityId: instance.id,
      ipAddress
    });

    const response = { id: instance.id, code: instance.code, status: instance.status };
    if (input.idempotencyKey) {
      await tx.idempotencyKey.create({
        data: {
          userId: auth.userId,
          key: input.idempotencyKey,
          scope,
          response
        }
      });
    }

    return response;
  });
}

export async function listWorkflowInstances(
  db: PrismaClient,
  auth: AuthContext,
  input: { page: number; pageSize: number; status?: string; pendingMine?: boolean }
) {
  const where: Prisma.WorkflowInstanceWhereInput = hasPermission(auth, "workflow.instance.read_all")
    ? {}
    : {
        OR: [
          { requesterId: auth.userId },
          {
            approvals: {
              some: { approverId: auth.userId }
            }
          }
        ]
      };

  if (input.status) {
    where.status = input.status as never;
  }
  if (input.pendingMine) {
    where.approvals = { some: { approverId: auth.userId, status: "PENDING" } };
  }

  const [data, total] = await Promise.all([
    db.workflowInstance.findMany({
      where,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        template: { select: { id: true, code: true, name: true } },
        requester: { select: { id: true, fullName: true } },
        currentStep: { select: { id: true, name: true, type: true } },
        approvals: {
          where: { status: "PENDING" },
          include: { approver: { select: { id: true, fullName: true } } }
        }
      }
    }),
    db.workflowInstance.count({ where })
  ]);

  return { data, total };
}

export async function getWorkflowInstance(db: PrismaClient, auth: AuthContext, id: string) {
  const instance = await db.workflowInstance.findUnique({
    where: { id },
    include: {
      template: true,
      workflowVersion: { include: { fields: { orderBy: { displayOrder: "asc" } } } },
      requester: { select: { id: true, fullName: true, email: true } },
      currentStep: true,
      values: true,
      steps: {
        orderBy: { createdAt: "asc" },
        include: { step: true, approvals: { include: { approver: { select: { id: true, fullName: true } } } } }
      },
      approvals: {
        orderBy: { createdAt: "asc" },
        include: { approver: { select: { id: true, fullName: true } }, step: true }
      }
    }
  });

  if (!instance || instance.deletedAt) {
    throw notFound("Không tìm thấy hồ sơ quy trình.");
  }
  if (
    !hasPermission(auth, "workflow.instance.read_all") &&
    instance.requesterId !== auth.userId &&
    !instance.approvals.some((approval) => approval.approverId === auth.userId)
  ) {
    throw forbidden("Bạn không có quyền xem hồ sơ này.");
  }

  return instance;
}

async function completeStepAndMoveNext(
  tx: Prisma.TransactionClient,
  input: {
    instanceId: string;
    instanceStepId: string;
    currentStep: StepWithAssignees;
    requesterId: string;
    formData: Record<string, unknown>;
    transitions: TransitionWithConditions[];
    previousApproverIds: string[];
  }
) {
  await tx.workflowInstanceStep.update({
    where: { id: input.instanceStepId },
    data: { status: "COMPLETED", completedAt: new Date() }
  });

  const transition = await pickNextTransition(input.transitions, input.currentStep.id, input.formData);
  if (!transition || transition.toStep.type === "END") {
    return tx.workflowInstance.update({
      where: { id: input.instanceId },
      data: {
        status: "APPROVED",
        currentStepId: transition?.toStepId ?? null,
        completedAt: new Date(),
        version: { increment: 1 }
      }
    });
  }

  await tx.workflowInstance.update({
    where: { id: input.instanceId },
    data: {
      currentStepId: transition.toStepId,
      status: "IN_PROGRESS",
      version: { increment: 1 }
    }
  });

  await startStep(tx, input.instanceId, transition.toStep, {
    requesterId: input.requesterId,
    formData: input.formData,
    previousApproverIds: input.previousApproverIds
  });

  return tx.workflowInstance.findUniqueOrThrow({ where: { id: input.instanceId } });
}

export async function actOnWorkflowInstance(
  db: PrismaClient,
  auth: AuthContext,
  instanceId: string,
  input: {
    action: Extract<WorkflowAction, "APPROVE" | "REJECT" | "REQUEST_INFO" | "RETURN">;
    comment?: string;
    idempotencyKey?: string;
  },
  ipAddress?: string
) {
  if (!hasPermission(auth, "workflow.instance.approve")) {
    throw forbidden();
  }

  const scope = `workflow.action:${instanceId}`;
  if (input.idempotencyKey) {
    const existing = await db.idempotencyKey.findUnique({
      where: { userId_key_scope: { userId: auth.userId, key: input.idempotencyKey, scope } }
    });
    if (existing?.response) {
      return existing.response;
    }
  }

  const instance = await db.workflowInstance.findUnique({
    where: { id: instanceId },
    include: {
      requester: true,
      currentStep: { include: { assignees: true } },
      workflowVersion: {
        include: {
          steps: { orderBy: { orderIndex: "asc" }, include: { assignees: true } },
          transitions: { include: { conditions: true, toStep: { include: { assignees: true } } } }
        }
      }
    }
  });

  if (!instance || instance.deletedAt || !instance.currentStep) {
    throw notFound("Không tìm thấy hồ sơ đang xử lý.");
  }
  const currentStep = instance.currentStep;
  if (["APPROVED", "REJECTED", "CANCELLED", "COMPLETED"].includes(instance.status)) {
    throw conflict("Hồ sơ đã kết thúc, không thể xử lý tiếp.");
  }

  const instanceStep = await db.workflowInstanceStep.findFirst({
    where: { instanceId, stepId: currentStep.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: { approvals: true }
  });

  const pendingApproval = instanceStep?.approvals.find(
    (approval) => approval.approverId === auth.userId && approval.status === "PENDING"
  );

  if (!instanceStep || !pendingApproval) {
    throw forbidden("Bạn không phải người đang chờ xử lý bước này.");
  }

  const formData = asRecord(instance.formData);

  return db.$transaction(async (tx) => {
    const nextStatusByAction: Record<string, ApprovalStatus> = {
      APPROVE: "APPROVED",
      REJECT: "REJECTED",
      REQUEST_INFO: "REQUESTED_INFO",
      RETURN: "RETURNED"
    };

    await tx.workflowApproval.update({
      where: { id: pendingApproval.id },
      data: {
        action: input.action,
        status: nextStatusByAction[input.action],
        comment: input.comment,
        ipAddress,
        idempotencyKey: input.idempotencyKey,
        actedAt: new Date()
      }
    });

    let response: unknown;

    if (input.action === "REJECT") {
      response = await tx.workflowInstance.update({
        where: { id: instanceId },
        data: { status: "REJECTED", completedAt: new Date(), version: { increment: 1 } }
      });
      await tx.workflowInstanceStep.update({
        where: { id: instanceStep.id },
        data: { status: "REJECTED", completedAt: new Date() }
      });
      await enqueueNotifications(tx, [
        {
          userId: instance.requesterId,
          title: "Hồ sơ bị từ chối",
          content: instance.code,
          type: "WORKFLOW_REJECTED",
          objectType: "workflow_instance",
          objectId: instanceId,
          link: `/workflows/instances/${instanceId}`
        }
      ]);
    } else if (input.action === "REQUEST_INFO") {
      response = await tx.workflowInstance.update({
        where: { id: instanceId },
        data: { status: "NEEDS_INFO", version: { increment: 1 } }
      });
      await enqueueNotifications(tx, [
        {
          userId: instance.requesterId,
          title: "Hồ sơ yêu cầu bổ sung",
          content: instance.code,
          type: "WORKFLOW_NEEDS_INFO",
          objectType: "workflow_instance",
          objectId: instanceId,
          link: `/workflows/instances/${instanceId}`
        }
      ]);
    } else if (input.action === "RETURN") {
      const currentIndex = instance.workflowVersion.steps.findIndex((step) => step.id === instance.currentStepId);
      const previousStep = [...instance.workflowVersion.steps]
        .slice(0, Math.max(0, currentIndex))
        .reverse()
        .find((step) => step.type !== "START");

      if (!previousStep) {
        throw badRequest("Không có bước trước để trả về.");
      }

      await tx.workflowInstanceStep.update({
        where: { id: instanceStep.id },
        data: { status: "RETURNED", completedAt: new Date() }
      });
      await tx.workflowInstance.update({
        where: { id: instanceId },
        data: { currentStepId: previousStep.id, status: "IN_PROGRESS", version: { increment: 1 } }
      });
      await startStep(tx, instanceId, previousStep, {
        requesterId: instance.requesterId,
        formData,
        previousApproverIds: [auth.userId]
      });
      response = await tx.workflowInstance.findUniqueOrThrow({ where: { id: instanceId } });
    } else {
      const allAssigneeIds = await resolveStepAssignees(tx, currentStep, {
        requesterId: instance.requesterId,
        formData
      });
      const approvals = await tx.workflowApproval.findMany({ where: { instanceStepId: instanceStep.id } });
      const approvedIds = approvals
        .filter((approval) => approval.status === "APPROVED" || approval.id === pendingApproval.id)
        .map((approval) => approval.approverId);

      if (currentStep.approvalMode === "SEQUENTIAL") {
        const nextApprover = allAssigneeIds.find((id) => !approvedIds.includes(id));
        if (nextApprover) {
          await tx.workflowApproval.create({
            data: {
              instanceId,
              instanceStepId: instanceStep.id,
              stepId: currentStep.id,
              approverId: nextApprover,
              status: "PENDING"
            }
          });
          await enqueueNotifications(tx, [
            {
              userId: nextApprover,
              title: "Có yêu cầu phê duyệt mới",
              content: currentStep.name,
              type: "WORKFLOW_APPROVAL_PENDING",
              objectType: "workflow_instance",
              objectId: instanceId,
              link: `/workflows/instances/${instanceId}`
            }
          ]);
          response = await tx.workflowInstance.findUniqueOrThrow({ where: { id: instanceId } });
        }
      }

      if (!response) {
        const completed = isStepComplete({
          mode: currentStep.approvalMode,
          rule: currentStep.completionRule,
          totalApprovers: allAssigneeIds.length,
          approvedCount: approvedIds.length,
          minCount: currentStep.minCount,
          minPercent: currentStep.minPercent
        });

        response = completed
          ? await completeStepAndMoveNext(tx, {
              instanceId,
              instanceStepId: instanceStep.id,
              currentStep,
              requesterId: instance.requesterId,
              formData,
              transitions: instance.workflowVersion.transitions,
              previousApproverIds: approvedIds
            })
          : await tx.workflowInstance.findUniqueOrThrow({ where: { id: instanceId } });
      }
    }

    await writeAuditLog(tx, {
      actorId: auth.userId,
      action: `workflow.instance.${input.action.toLowerCase()}`,
      entityType: "workflow_instances",
      entityId: instanceId,
      ipAddress,
      metadata: { comment: input.comment }
    });

    if (input.idempotencyKey) {
      const storedResponse =
        response && typeof response === "object"
          ? {
              id: (response as { id?: string }).id,
              status: (response as { status?: string }).status
            }
          : response;
      await tx.idempotencyKey.create({
        data: {
          userId: auth.userId,
          key: input.idempotencyKey,
          scope,
          response: storedResponse as Prisma.InputJsonValue
        }
      });
    }

    return response;
  });
}

export async function compareWorkflowVersions(db: PrismaClient, leftId: string, rightId: string) {
  const [left, right] = await Promise.all([
    db.workflowVersion.findUnique({
      where: { id: leftId },
      include: { fields: true, steps: { include: { assignees: true } }, transitions: { include: { conditions: true } } }
    }),
    db.workflowVersion.findUnique({
      where: { id: rightId },
      include: { fields: true, steps: { include: { assignees: true } }, transitions: { include: { conditions: true } } }
    })
  ]);
  if (!left || !right) {
    throw notFound("Không tìm thấy phiên bản quy trình để so sánh.");
  }

  return {
    left,
    right,
    summary: {
      fieldsChanged: left.fields.length !== right.fields.length,
      stepsChanged: left.steps.length !== right.steps.length,
      transitionsChanged: left.transitions.length !== right.transitions.length
    }
  };
}
