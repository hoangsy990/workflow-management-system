import type { FastifyInstance } from "fastify";
import type { TaskStatus } from "@prisma/client";
import { prisma } from "../../prisma.js";
import { requireAuth } from "../auth/auth.guard.js";
import { visibleTaskWhere } from "../tasks/task.service.js";
import { daysRemaining, isTaskOverdue } from "../tasks/task.domain.js";

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

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard", { preHandler: requireAuth }, async (request) => {
    const auth = request.auth!;
    const taskScope = await visibleTaskWhere(prisma, auth);
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
      prisma.task.count({ where: { AND: [taskScope, { status: activeStatus }] } }),
      prisma.task.count({ where: { AND: [taskScope, { assignees: { some: { userId: auth.userId } }, status: activeStatus }] } }),
      prisma.task.count({
        where: { AND: [taskScope, { dueDate: { gte: new Date(), lte: inDays(3) }, status: activeStatus }] }
      }),
      prisma.task.count({ where: { AND: [taskScope, { dueDate: { lt: new Date() }, status: activeStatus }] } }),
      prisma.task.count({
        where: { AND: [taskScope, { status: "PENDING_REVIEW", OR: [{ creatorId: auth.userId }, { managerId: auth.userId }] }] }
      }),
      prisma.workflowApproval.count({ where: { approverId: auth.userId, status: "PENDING" } }),
      prisma.workflowInstance.count({ where: { requesterId: auth.userId } }),
      prisma.task.groupBy({
        by: ["status"],
        where: taskScope,
        _count: true
      }),
      prisma.task.groupBy({
        by: ["departmentId"],
        where: taskScope,
        _count: true
      }),
      prisma.task.findMany({
        where: {
          AND: [
            taskScope,
            {
              OR: [{ dueDate: { lt: inDays(3) } }, { priority: { in: ["HIGH", "URGENT"] } }, { status: "PENDING_REVIEW" }]
            }
          ]
        },
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
