import type { FastifyInstance } from "fastify";
import { Prisma, TaskPriority, TaskStatus, WorkflowInstanceStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { parseQuery } from "../../http/validation.js";
import { requireAuth } from "../auth/auth.guard.js";
import { visibleTaskWhere } from "../tasks/task.service.js";
import { visibleWorkflowInstanceWhere } from "../workflows/workflow.service.js";

const reportQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  taskStatus: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  workflowStatus: z.nativeEnum(WorkflowInstanceStatus).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
});

function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function taskReportFilters(query: z.infer<typeof reportQuerySchema>): Prisma.TaskWhereInput {
  const filters: Prisma.TaskWhereInput[] = [];

  if (query.departmentId) filters.push({ departmentId: query.departmentId });
  if (query.taskStatus) filters.push({ status: query.taskStatus });
  if (query.priority) filters.push({ priority: query.priority });

  if (query.from || query.to) {
    const nullableRange: Prisma.DateTimeNullableFilter = {};
    const requiredRange: Prisma.DateTimeFilter = {};
    if (query.from) {
      nullableRange.gte = query.from;
      requiredRange.gte = query.from;
    }
    if (query.to) {
      nullableRange.lte = endOfDay(query.to);
      requiredRange.lte = endOfDay(query.to);
    }
    filters.push({
      OR: [{ startDate: nullableRange }, { dueDate: nullableRange }, { createdAt: requiredRange }]
    });
  }

  return filters.length > 0 ? { AND: filters } : {};
}

function workflowReportFilters(query: z.infer<typeof reportQuerySchema>): Prisma.WorkflowInstanceWhereInput {
  const filters: Prisma.WorkflowInstanceWhereInput[] = [];

  if (query.workflowStatus) filters.push({ status: query.workflowStatus });
  if (query.departmentId) filters.push({ requester: { departmentId: query.departmentId } });

  if (query.from || query.to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) createdAt.gte = query.from;
    if (query.to) createdAt.lte = endOfDay(query.to);
    filters.push({ createdAt });
  }

  return filters.length > 0 ? { AND: filters } : {};
}

async function attachDepartmentNames(stats: Array<{ departmentId: string | null; _count: number }>) {
  const departmentIds = stats.map((item) => item.departmentId).filter((id): id is string => Boolean(id));
  const departments =
    departmentIds.length > 0
      ? await prisma.department.findMany({
          where: { id: { in: departmentIds } },
          select: { id: true, name: true, code: true }
        })
      : [];
  const departmentById = new Map(departments.map((department) => [department.id, department]));
  return stats
    .map((item) => ({
      departmentId: item.departmentId,
      department: item.departmentId ? departmentById.get(item.departmentId) ?? null : null,
      count: item._count
    }))
    .sort((a, b) => b.count - a.count);
}

async function attachWorkflowTemplateNames(stats: Array<{ templateId: string; _count: number }>) {
  const templateIds = stats.map((item) => item.templateId);
  const templates =
    templateIds.length > 0
      ? await prisma.workflowTemplate.findMany({
          where: { id: { in: templateIds } },
          select: { id: true, code: true, name: true }
        })
      : [];
  const templateById = new Map(templates.map((template) => [template.id, template]));
  return stats
    .map((item) => ({
      templateId: item.templateId,
      template: templateById.get(item.templateId) ?? null,
      count: item._count
    }))
    .sort((a, b) => b.count - a.count);
}

export async function reportRoutes(app: FastifyInstance) {
  app.get("/reports/summary", { preHandler: requireAuth }, async (request) => {
    const auth = request.auth!;
    const query = parseQuery(request, reportQuerySchema);
    const taskScope = await visibleTaskWhere(prisma, auth);
    const taskFilters = taskReportFilters(query);
    const workflowScope = visibleWorkflowInstanceWhere(auth);
    const workflowFilters = workflowReportFilters(query);
    const taskWhere = (extra?: Prisma.TaskWhereInput): Prisma.TaskWhereInput => ({
      AND: [taskScope, taskFilters, extra ?? {}]
    });
    const workflowWhere = (extra?: Prisma.WorkflowInstanceWhereInput): Prisma.WorkflowInstanceWhereInput => ({
      AND: [workflowScope, workflowFilters, extra ?? {}]
    });

    const activeTaskStatus = { notIn: ["DONE", "CANCELLED"] as TaskStatus[] };
    const activeWorkflowStatus = { in: ["SUBMITTED", "IN_PROGRESS", "NEEDS_INFO"] as WorkflowInstanceStatus[] };

    const [
      totalTasks,
      completedTasks,
      overdueTasks,
      progressAggregate,
      tasksByStatus,
      tasksByPriority,
      tasksByDepartment,
      recentTasks,
      totalInstances,
      approvedInstances,
      rejectedInstances,
      pendingMine,
      instancesByStatus,
      instancesByTemplate,
      recentInstances
    ] = await Promise.all([
      prisma.task.count({ where: taskWhere() }),
      prisma.task.count({ where: taskWhere({ status: "DONE" }) }),
      prisma.task.count({ where: taskWhere({ status: activeTaskStatus, dueDate: { lt: new Date() } }) }),
      prisma.task.aggregate({ where: taskWhere(), _avg: { progress: true } }),
      prisma.task.groupBy({ by: ["status"], where: taskWhere(), _count: true }),
      prisma.task.groupBy({ by: ["priority"], where: taskWhere(), _count: true }),
      prisma.task.groupBy({ by: ["departmentId"], where: taskWhere(), _count: true }),
      prisma.task.findMany({
        where: taskWhere(),
        take: 8,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        include: {
          department: { select: { id: true, code: true, name: true } },
          assignees: {
            take: 3,
            include: { user: { select: { id: true, fullName: true } } }
          }
        }
      }),
      prisma.workflowInstance.count({ where: workflowWhere() }),
      prisma.workflowInstance.count({ where: workflowWhere({ status: { in: ["APPROVED", "COMPLETED"] } }) }),
      prisma.workflowInstance.count({ where: workflowWhere({ status: "REJECTED" }) }),
      prisma.workflowInstance.count({
        where: workflowWhere({
          status: activeWorkflowStatus,
          approvals: { some: { approverId: auth.userId, status: "PENDING" } }
        })
      }),
      prisma.workflowInstance.groupBy({ by: ["status"], where: workflowWhere(), _count: true }),
      prisma.workflowInstance.groupBy({ by: ["templateId"], where: workflowWhere(), _count: true }),
      prisma.workflowInstance.findMany({
        where: workflowWhere(),
        take: 8,
        orderBy: { createdAt: "desc" },
        include: {
          template: { select: { id: true, code: true, name: true } },
          requester: { select: { id: true, fullName: true, department: { select: { id: true, name: true } } } },
          currentStep: { select: { id: true, name: true, type: true } }
        }
      })
    ]);

    return {
      filters: query,
      tasks: {
        cards: {
          total: totalTasks,
          completed: completedTasks,
          overdue: overdueTasks,
          completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
          averageProgress: Math.round(Number(progressAggregate._avg.progress ?? 0))
        },
        byStatus: tasksByStatus,
        byPriority: tasksByPriority,
        byDepartment: await attachDepartmentNames(tasksByDepartment),
        recent: recentTasks
      },
      workflows: {
        cards: {
          total: totalInstances,
          approved: approvedInstances,
          rejected: rejectedInstances,
          pendingMine
        },
        byStatus: instancesByStatus,
        byTemplate: await attachWorkflowTemplateNames(instancesByTemplate),
        recent: recentInstances
      }
    };
  });
}
