import type { FastifyInstance } from "fastify";
import type { Prisma, TaskStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { parseQuery } from "../../http/validation.js";
import { requireAuth } from "../auth/auth.guard.js";
import { visibleTaskWhere } from "../tasks/task.service.js";
import { daysRemaining, isTaskOverdue } from "../tasks/task.domain.js";

const dashboardQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
});

function inDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function withComputedTaskFields<T extends { status: TaskStatus; dueDate: Date | null }>(task: T) {
  const overdue = isTaskOverdue(task);
  return {
    ...task,
    isOverdue: overdue,
    displayStatus: overdue ? "OVERDUE" : task.status,
    daysRemaining: daysRemaining(task.dueDate)
  };
}

function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function dashboardTaskFilters(query: z.infer<typeof dashboardQuerySchema>): Prisma.TaskWhereInput {
  const filters: Prisma.TaskWhereInput[] = [];

  if (query.departmentId) {
    filters.push({ departmentId: query.departmentId });
  }

  if (query.from || query.to) {
    const dateRange: Prisma.DateTimeNullableFilter = {};
    if (query.from) dateRange.gte = query.from;
    if (query.to) dateRange.lte = endOfDay(query.to);
    filters.push({ OR: [{ startDate: dateRange }, { dueDate: dateRange }] });
  }

  return filters.length > 0 ? { AND: filters } : {};
}

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard", { preHandler: requireAuth }, async (request) => {
    const auth = request.auth!;
    const query = parseQuery(request, dashboardQuerySchema);
    const taskScope = await visibleTaskWhere(prisma, auth);
    const taskFilters = dashboardTaskFilters(query);
    const taskWhere = (extra?: Prisma.TaskWhereInput): Prisma.TaskWhereInput => ({
      AND: [taskScope, taskFilters, extra ?? {}]
    });
    const activeStatus = { notIn: ["DONE", "CANCELLED"] as TaskStatus[] };

    const [
      activeTasks,
      pendingTasks,
      dueSoon,
      overdue,
      pendingReview,
      approvalPendingMine,
      myInstances,
      tasksByStatus,
      tasksByDepartment,
      attentionTasks,
      recentInstances
    ] = await Promise.all([
      prisma.task.count({ where: taskWhere({ status: activeStatus }) }),
      prisma.task.count({ where: taskWhere({ assignees: { some: { userId: auth.userId } }, status: activeStatus }) }),
      prisma.task.count({
        where: taskWhere({ dueDate: { gte: new Date(), lte: inDays(3) }, status: activeStatus })
      }),
      prisma.task.count({ where: taskWhere({ dueDate: { lt: new Date() }, status: activeStatus }) }),
      prisma.task.count({
        where: taskWhere({ status: "PENDING_REVIEW", OR: [{ creatorId: auth.userId }, { managerId: auth.userId }] })
      }),
      prisma.workflowApproval.count({ where: { approverId: auth.userId, status: "PENDING" } }),
      prisma.workflowInstance.count({ where: { requesterId: auth.userId } }),
      prisma.task.groupBy({
        by: ["status"],
        where: taskWhere(),
        _count: true
      }),
      prisma.task.groupBy({
        by: ["departmentId"],
        where: taskWhere(),
        _count: true
      }),
      prisma.task.findMany({
        where: taskWhere({
          OR: [{ dueDate: { lt: inDays(3) } }, { priority: { in: ["HIGH", "URGENT"] } }, { status: "PENDING_REVIEW" }]
        }),
        take: 8,
        orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
        include: {
          assignees: { include: { user: { select: { id: true, fullName: true } } } },
          department: { select: { id: true, name: true } }
        }
      }),
      prisma.workflowInstance.findMany({
        where: {
          OR: [{ requesterId: auth.userId }, { approvals: { some: { approverId: auth.userId } } }]
        },
        take: 8,
        orderBy: { createdAt: "desc" },
        include: {
          template: { select: { id: true, name: true } },
          currentStep: { select: { id: true, name: true } }
        }
      })
    ]);
    const departmentIds = tasksByDepartment
      .map((item) => item.departmentId)
      .filter((id): id is string => Boolean(id));
    const departments =
      departmentIds.length > 0
        ? await prisma.department.findMany({
            where: { id: { in: departmentIds } },
            select: { id: true, name: true }
          })
        : [];
    const departmentById = new Map(departments.map((department) => [department.id, department]));
    const taskDepartmentStats = tasksByDepartment
      .map((item) => ({
        departmentId: item.departmentId,
        department: item.departmentId ? departmentById.get(item.departmentId) ?? null : null,
        count: item._count
      }))
      .sort((a, b) => b.count - a.count);

    return {
      cards: {
        activeTasks,
        pendingTasks,
        dueSoon,
        overdue,
        pendingReview,
        approvalPendingMine,
        myInstances
      },
      tasksByStatus,
      tasksByDepartment: taskDepartmentStats,
      attentionTasks: attentionTasks.map(withComputedTaskFields),
      recentInstances
    };
  });
}
