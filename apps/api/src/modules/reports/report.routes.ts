import type { FastifyInstance } from "fastify";
import { Prisma, TaskPriority, TaskStatus, WorkflowInstanceStatus } from "@prisma/client";
import { z } from "zod";
import type { AuthContext } from "../../types/fastify.js";
import { badRequest } from "../../http/errors.js";
import { prisma } from "../../prisma.js";
import { parseQuery } from "../../http/validation.js";
import { requireAuth } from "../auth/auth.guard.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { visibleTaskWhere } from "../tasks/task.service.js";
import { visibleWorkflowInstanceWhere } from "../workflows/workflow.service.js";
import { makePdf } from "./pdf.js";
import { makeXlsx } from "./xlsx.js";

const reportQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  taskStatus: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  workflowStatus: z.nativeEnum(WorkflowInstanceStatus).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
});
const reportDrilldownQuerySchema = reportQuerySchema.extend({
  entity: z.enum(["tasks", "workflows"]),
  bucket: z.enum(["taskStatus", "priority", "department", "workflowStatus", "template"]),
  value: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
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

function isTaskStatus(value: string | undefined): value is TaskStatus {
  return Boolean(value && Object.values(TaskStatus).includes(value as TaskStatus));
}

function isTaskPriority(value: string | undefined): value is TaskPriority {
  return Boolean(value && Object.values(TaskPriority).includes(value as TaskPriority));
}

function isWorkflowStatus(value: string | undefined): value is WorkflowInstanceStatus {
  return Boolean(value && Object.values(WorkflowInstanceStatus).includes(value as WorkflowInstanceStatus));
}

function taskDrilldownFilter(query: z.infer<typeof reportDrilldownQuerySchema>): Prisma.TaskWhereInput {
  if (query.bucket === "taskStatus") {
    if (!isTaskStatus(query.value)) throw badRequest("Bucket trạng thái công việc không hợp lệ.");
    return { status: query.value };
  }
  if (query.bucket === "priority") {
    if (!isTaskPriority(query.value)) throw badRequest("Bucket ưu tiên công việc không hợp lệ.");
    return { priority: query.value };
  }
  if (query.bucket === "department") {
    return { departmentId: query.value === "none" ? null : query.value };
  }
  throw badRequest("Bucket drill-down không áp dụng cho công việc.");
}

function workflowDrilldownFilter(query: z.infer<typeof reportDrilldownQuerySchema>): Prisma.WorkflowInstanceWhereInput {
  if (query.bucket === "workflowStatus") {
    if (!isWorkflowStatus(query.value)) throw badRequest("Bucket trạng thái hồ sơ không hợp lệ.");
    return { status: query.value };
  }
  if (query.bucket === "template") {
    if (!query.value) throw badRequest("Bucket mẫu quy trình không hợp lệ.");
    return { templateId: query.value };
  }
  throw badRequest("Bucket drill-down không áp dụng cho hồ sơ quy trình.");
}

function serializeReportFilters(query: z.infer<typeof reportQuerySchema>) {
  return {
    departmentId: query.departmentId ?? null,
    taskStatus: query.taskStatus ?? null,
    priority: query.priority ?? null,
    workflowStatus: query.workflowStatus ?? null,
    from: query.from?.toISOString() ?? null,
    to: query.to?.toISOString() ?? null
  };
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvDate(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh"
  }).format(new Date(value));
}

function toCsv(rows: unknown[][]) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

type ExportTask = {
  code: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  dueDate: Date | null;
  createdAt: Date;
  department: { name: string } | null;
  assignees: Array<{ user: { fullName: string } }>;
};

type ExportWorkflow = {
  code: string;
  status: WorkflowInstanceStatus;
  createdAt: Date;
  template: { name: string };
  requester: { fullName: string; department: { name: string } | null };
  currentStep: { name: string } | null;
};

async function loadReportExportData(auth: AuthContext, query: z.infer<typeof reportQuerySchema>) {
  const taskWhere: Prisma.TaskWhereInput = {
    AND: [await visibleTaskWhere(prisma, auth), taskReportFilters(query)]
  };
  const workflowWhere: Prisma.WorkflowInstanceWhereInput = {
    AND: [visibleWorkflowInstanceWhere(auth), workflowReportFilters(query)]
  };
  const [tasks, workflows] = await Promise.all([
    prisma.task.findMany({
      where: taskWhere,
      take: 5000,
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        department: { select: { name: true } },
        assignees: { include: { user: { select: { fullName: true } } } }
      }
    }),
    prisma.workflowInstance.findMany({
      where: workflowWhere,
      take: 5000,
      orderBy: { createdAt: "desc" },
      include: {
        template: { select: { name: true } },
        requester: { select: { fullName: true, department: { select: { name: true } } } },
        currentStep: { select: { name: true } }
      }
    })
  ]);
  return { tasks, workflows };
}

function exportRows(tasks: ExportTask[], workflows: ExportWorkflow[]) {
  return [
    ["Loại", "Mã", "Tên/Mẫu", "Trạng thái", "Ưu tiên/Bước", "Phòng ban/Người tạo", "Người liên quan", "Tiến độ", "Ngày"],
    ...tasks.map((task) => [
      "Công việc",
      task.code,
      task.title,
      task.status,
      task.priority,
      task.department?.name ?? "",
      task.assignees.map((assignee) => assignee.user.fullName).join("; "),
      `${task.progress}%`,
      csvDate(task.dueDate ?? task.createdAt)
    ]),
    ...workflows.map((instance) => [
      "Hồ sơ quy trình",
      instance.code,
      instance.template.name,
      instance.status,
      instance.currentStep?.name ?? "",
      instance.requester.department?.name ?? "",
      instance.requester.fullName,
      "",
      csvDate(instance.createdAt)
    ])
  ];
}

async function auditReportExport(auth: AuthContext, requestIp: string, format: "csv" | "xlsx" | "pdf", query: z.infer<typeof reportQuerySchema>, counts: { taskCount: number; workflowCount: number }) {
  await writeAuditLog(prisma, {
    actorId: auth.userId,
    action: `report.export.${format}`,
    entityType: "reports",
    ipAddress: requestIp,
    metadata: {
      filters: serializeReportFilters(query),
      ...counts
    }
  });
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

  app.get("/reports/export.csv", { preHandler: requireAuth }, async (request, reply) => {
    const auth = request.auth!;
    const query = parseQuery(request, reportQuerySchema);
    const { tasks, workflows } = await loadReportExportData(auth, query);
    const rows = exportRows(tasks, workflows);
    await auditReportExport(auth, request.ip, "csv", query, { taskCount: tasks.length, workflowCount: workflows.length });

    const fileName = `workflow-report-${new Date().toISOString().slice(0, 10)}.csv`;
    return reply
      .type("text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`)
      .send(toCsv(rows));
  });

  app.get("/reports/export.xlsx", { preHandler: requireAuth }, async (request, reply) => {
    const auth = request.auth!;
    const query = parseQuery(request, reportQuerySchema);
    const { tasks, workflows } = await loadReportExportData(auth, query);
    const rows = exportRows(tasks, workflows);
    await auditReportExport(auth, request.ip, "xlsx", query, { taskCount: tasks.length, workflowCount: workflows.length });

    const fileName = `workflow-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
    return reply
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`)
      .send(makeXlsx(rows));
  });

  app.get("/reports/export.pdf", { preHandler: requireAuth }, async (request, reply) => {
    const auth = request.auth!;
    const query = parseQuery(request, reportQuerySchema);
    const { tasks, workflows } = await loadReportExportData(auth, query);
    const rows = exportRows(tasks, workflows);
    await auditReportExport(auth, request.ip, "pdf", query, { taskCount: tasks.length, workflowCount: workflows.length });

    const fileName = `workflow-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    return reply
      .type("application/pdf")
      .header("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`)
      .send(makePdf(rows, "Workflow Management System - Report"));
  });

  app.get("/reports/drilldown", { preHandler: requireAuth }, async (request) => {
    const auth = request.auth!;
    const query = parseQuery(request, reportDrilldownQuerySchema);

    if (query.entity === "tasks") {
      const where: Prisma.TaskWhereInput = {
        AND: [await visibleTaskWhere(prisma, auth), taskReportFilters(query), taskDrilldownFilter(query)]
      };
      const [data, total] = await Promise.all([
        prisma.task.findMany({
          where,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
          include: {
            department: { select: { id: true, code: true, name: true } },
            assignees: {
              take: 3,
              include: { user: { select: { id: true, fullName: true } } }
            }
          }
        }),
        prisma.task.count({ where })
      ]);
      return {
        entity: "tasks",
        bucket: query.bucket,
        value: query.value,
        data,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.pageSize))
        }
      };
    }

    const where: Prisma.WorkflowInstanceWhereInput = {
      AND: [visibleWorkflowInstanceWhere(auth), workflowReportFilters(query), workflowDrilldownFilter(query)]
    };
    const [data, total] = await Promise.all([
      prisma.workflowInstance.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          template: { select: { id: true, code: true, name: true } },
          requester: { select: { id: true, fullName: true, department: { select: { id: true, name: true } } } },
          currentStep: { select: { id: true, name: true, type: true } }
        }
      }),
      prisma.workflowInstance.count({ where })
    ]);
    return {
      entity: "workflows",
      bucket: query.bucket,
      value: query.value,
      data,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize))
      }
    };
  });
}
