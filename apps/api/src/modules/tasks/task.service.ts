import type { Prisma, PrismaClient, Task, TaskPriority, TaskStatus } from "@prisma/client";
import type { AuthContext } from "../../types/fastify.js";
import { badRequest, forbidden, notFound } from "../../http/errors.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { enqueueNotifications } from "../notifications/notification.service.js";
import { assertNoTaskCycle, daysRemaining, isTaskOverdue, nextStatusAfterProgress } from "./task.domain.js";

type Db = PrismaClient | Prisma.TransactionClient;

export interface TaskListInput {
  page: number;
  pageSize: number;
  keyword?: string;
  code?: string;
  status?: TaskStatus;
  assigneeId?: string;
  creatorId?: string;
  managerId?: string;
  departmentId?: string;
  priority?: TaskPriority;
  categoryId?: string;
  tagId?: string;
  from?: Date;
  to?: Date;
  overdue?: boolean;
  myView?: "assignee" | "assigner" | "manager" | "follower" | "review" | "overdue" | "done";
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  assignerId?: string;
  managerId?: string;
  assigneeIds: string[];
  followerIds: string[];
  departmentId?: string;
  startDate?: Date;
  dueDate?: Date;
  priority: TaskPriority;
  categoryId?: string;
  tagIds?: string[];
  parentTaskId?: string;
  relatedTaskIds?: string[];
  requiresReview: boolean;
  autoCalculateParentProgress?: boolean;
  repeatFrequency?: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  customFields?: Record<string, unknown>;
}

function hasPermission(auth: AuthContext, permission: string): boolean {
  return auth.permissions.includes(permission);
}

function todayCodePrefix() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `TASK-${year}${month}${day}`;
}

async function generateTaskCode(db: Db) {
  const prefix = todayCodePrefix();
  const count = await db.task.count({
    where: {
      code: { startsWith: prefix }
    }
  });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

async function directReportIds(db: Db, managerId: string) {
  const users = await db.user.findMany({
    where: { managerId, deletedAt: null },
    select: { id: true }
  });
  return users.map((user) => user.id);
}

export async function visibleTaskWhere(db: Db, auth: AuthContext): Promise<Prisma.TaskWhereInput> {
  const base: Prisma.TaskWhereInput = { deletedAt: null };

  if (hasPermission(auth, "task.read_all")) {
    return base;
  }

  const or: Prisma.TaskWhereInput[] = [
    { creatorId: auth.userId },
    { assignerId: auth.userId },
    { managerId: auth.userId },
    { assignees: { some: { userId: auth.userId } } },
    { followers: { some: { userId: auth.userId } } }
  ];

  if (hasPermission(auth, "task.read_team")) {
    const reportIds = await directReportIds(db, auth.userId);
    if (reportIds.length > 0) {
      or.push(
        { creatorId: { in: reportIds } },
        { managerId: { in: reportIds } },
        { assignees: { some: { userId: { in: reportIds } } } }
      );
    }
  }

  return { AND: [base, { OR: or }] };
}

async function canReadTask(db: Db, auth: AuthContext, taskId: string) {
  const count = await db.task.count({
    where: {
      id: taskId,
      ...(await visibleTaskWhere(db, auth))
    }
  });
  return count > 0;
}

async function ensureCanReadTask(db: Db, auth: AuthContext, taskId: string) {
  if (!(await canReadTask(db, auth, taskId))) {
    throw forbidden("Bạn không có quyền xem công việc này.");
  }
}

function canEditTask(auth: AuthContext, task: Pick<Task, "creatorId" | "assignerId" | "managerId">) {
  return (
    hasPermission(auth, "task.update_any") ||
    task.creatorId === auth.userId ||
    task.assignerId === auth.userId ||
    task.managerId === auth.userId
  );
}

function myRelatedTaskWhere(auth: AuthContext): Prisma.TaskWhereInput {
  return {
    OR: [
      { creatorId: auth.userId },
      { assignerId: auth.userId },
      { managerId: auth.userId },
      { assignees: { some: { userId: auth.userId } } },
      { followers: { some: { userId: auth.userId } } }
    ]
  };
}

function withComputedTaskFields<T extends { status: TaskStatus; dueDate: Date | null }>(task: T) {
  return {
    ...task,
    isOverdue: isTaskOverdue(task),
    displayStatus: isTaskOverdue(task) ? "OVERDUE" : task.status,
    daysRemaining: daysRemaining(task.dueDate)
  };
}

export async function listTasks(db: PrismaClient, auth: AuthContext, input: TaskListInput) {
  const scope = await visibleTaskWhere(db, auth);
  const filters: Prisma.TaskWhereInput[] = [scope];

  if (input.keyword) {
    filters.push({
      OR: [
        { title: { contains: input.keyword, mode: "insensitive" } },
        { description: { contains: input.keyword, mode: "insensitive" } },
        { code: { contains: input.keyword, mode: "insensitive" } }
      ]
    });
  }
  if (input.code) filters.push({ code: { contains: input.code, mode: "insensitive" } });
  if (input.status) filters.push({ status: input.status });
  if (input.assigneeId) filters.push({ assignees: { some: { userId: input.assigneeId } } });
  if (input.creatorId) filters.push({ creatorId: input.creatorId });
  if (input.managerId) filters.push({ managerId: input.managerId });
  if (input.departmentId) filters.push({ departmentId: input.departmentId });
  if (input.priority) filters.push({ priority: input.priority });
  if (input.categoryId) filters.push({ categoryId: input.categoryId });
  if (input.tagId) filters.push({ tags: { some: { tagId: input.tagId } } });
  if (input.from || input.to) {
    filters.push({
      dueDate: {
        gte: input.from,
        lte: input.to
      }
    });
  }
  if (input.overdue || input.myView === "overdue") {
    filters.push({
      dueDate: { lt: new Date() },
      status: { notIn: ["DONE", "CANCELLED"] }
    });
  }
  if (input.myView === "assignee") filters.push({ assignees: { some: { userId: auth.userId } } });
  if (input.myView === "assigner") filters.push({ OR: [{ assignerId: auth.userId }, { creatorId: auth.userId }] });
  if (input.myView === "manager") filters.push({ managerId: auth.userId });
  if (input.myView === "follower") filters.push({ followers: { some: { userId: auth.userId } } });
  if (input.myView === "review") filters.push({ status: "PENDING_REVIEW", OR: [{ creatorId: auth.userId }, { managerId: auth.userId }] });
  if (input.myView === "overdue" || input.myView === "done") filters.push(myRelatedTaskWhere(auth));
  if (input.myView === "done") filters.push({ status: "DONE" });

  const where: Prisma.TaskWhereInput = { AND: filters };

  const [data, total] = await Promise.all([
    db.task.findMany({
      where,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        creator: { select: { id: true, fullName: true } },
        assigner: { select: { id: true, fullName: true } },
        manager: { select: { id: true, fullName: true } },
        department: { select: { id: true, name: true } },
        category: true,
        assignees: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
        followers: { include: { user: { select: { id: true, fullName: true } } } },
        tags: { include: { tag: true } },
        _count: { select: { subTasks: true, comments: true, attachments: true } }
      }
    }),
    db.task.count({ where })
  ]);

  return { data: data.map(withComputedTaskFields), total };
}

export async function getTask(db: PrismaClient, auth: AuthContext, id: string) {
  await ensureCanReadTask(db, auth, id);
  const task = await db.task.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, fullName: true, email: true } },
      assigner: { select: { id: true, fullName: true } },
      manager: { select: { id: true, fullName: true } },
      department: true,
      category: true,
      parentTask: { select: { id: true, code: true, title: true } },
      subTasks: { select: { id: true, code: true, title: true, progress: true, status: true } },
      assignees: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
      followers: { include: { user: { select: { id: true, fullName: true } } } },
      tags: { include: { tag: true } },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, fullName: true, avatarUrl: true } },
          attachments: {
            where: { deletedAt: null },
            select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true }
          }
        }
      },
      progressLogs: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, fullName: true } } }
      },
      evaluations: {
        orderBy: { createdAt: "desc" },
        include: { evaluator: { select: { id: true, fullName: true } } }
      },
      attachments: true
    }
  });

  if (!task) {
    throw notFound("Không tìm thấy công việc.");
  }

  const subTaskProgress =
    task.subTasks.length > 0
      ? Math.round(task.subTasks.reduce((sum, subTask) => sum + subTask.progress, 0) / task.subTasks.length)
      : null;

  return {
    ...withComputedTaskFields(task),
    subTaskProgress
  };
}

export async function createTask(db: PrismaClient, auth: AuthContext, input: CreateTaskInput, ipAddress?: string) {
  if (!hasPermission(auth, "task.create")) {
    throw forbidden();
  }
  if (input.startDate && input.dueDate && input.startDate.getTime() > input.dueDate.getTime()) {
    throw badRequest("Ngày bắt đầu không được sau hạn hoàn thành.");
  }

  return db.$transaction(async (tx) => {
    const code = await generateTaskCode(tx);
    const task = await tx.task.create({
      data: {
        code,
        title: input.title,
        description: input.description,
        creatorId: auth.userId,
        assignerId: input.assignerId ?? auth.userId,
        managerId: input.managerId,
        departmentId: input.departmentId,
        categoryId: input.categoryId,
        parentTaskId: input.parentTaskId,
        startDate: input.startDate,
        dueDate: input.dueDate,
        priority: input.priority,
        requiresReview: input.requiresReview,
        autoCalculateParentProgress: input.autoCalculateParentProgress ?? false,
        repeatFrequency: input.repeatFrequency ?? "NONE",
        customFields: input.customFields as Prisma.InputJsonValue | undefined,
        assignees: input.assigneeIds.length
          ? { createMany: { data: input.assigneeIds.map((userId) => ({ userId })), skipDuplicates: true } }
          : undefined,
        followers: input.followerIds.length
          ? { createMany: { data: input.followerIds.map((userId) => ({ userId })), skipDuplicates: true } }
          : undefined,
        tags: input.tagIds?.length
          ? { createMany: { data: input.tagIds.map((tagId) => ({ tagId })), skipDuplicates: true } }
          : undefined
      }
    });

    if (input.relatedTaskIds?.length) {
      await tx.taskDependency.createMany({
        data: input.relatedTaskIds.map((targetTaskId) => ({
          sourceTaskId: task.id,
          targetTaskId,
          type: "RELATES_TO"
        })),
        skipDuplicates: true
      });
    }

    await writeAuditLog(tx, {
      actorId: auth.userId,
      action: "task.create",
      entityType: "tasks",
      entityId: task.id,
      ipAddress,
      metadata: { code: task.code, assigneeIds: input.assigneeIds }
    });

    await enqueueNotifications(tx, [
      ...input.assigneeIds.map((userId) => ({
        userId,
        title: "Bạn được giao công việc mới",
        content: `${task.code} - ${task.title}`,
        type: "TASK_ASSIGNED",
        objectType: "task",
        objectId: task.id,
        link: `/tasks/${task.id}`
      })),
      ...input.followerIds.map((userId) => ({
        userId,
        title: "Bạn được thêm theo dõi công việc",
        content: `${task.code} - ${task.title}`,
        type: "TASK_FOLLOWER_ADDED",
        objectType: "task",
        objectId: task.id,
        link: `/tasks/${task.id}`
      }))
    ]);

    return task;
  });
}

export async function updateTask(
  db: PrismaClient,
  auth: AuthContext,
  id: string,
  input: Partial<CreateTaskInput> & { status?: TaskStatus },
  ipAddress?: string
) {
  const task = await db.task.findUnique({ where: { id } });
  if (!task || task.deletedAt) {
    throw notFound("Không tìm thấy công việc.");
  }
  if (!canEditTask(auth, task)) {
    throw forbidden("Bạn không có quyền chỉnh sửa công việc này.");
  }
  if (input.parentTaskId) {
    await assertNoTaskCycle(id, input.parentTaskId, async (taskId) => {
      const parent = await db.task.findUnique({ where: { id: taskId }, select: { parentTaskId: true } });
      return parent?.parentTaskId ?? null;
    });
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        assignerId: input.assignerId,
        managerId: input.managerId,
        departmentId: input.departmentId,
        categoryId: input.categoryId,
        parentTaskId: input.parentTaskId,
        startDate: input.startDate,
        dueDate: input.dueDate,
        priority: input.priority,
        requiresReview: input.requiresReview,
        autoCalculateParentProgress: input.autoCalculateParentProgress,
        repeatFrequency: input.repeatFrequency,
        customFields: input.customFields as Prisma.InputJsonValue | undefined,
        status: input.status,
        version: { increment: 1 }
      }
    });

    if (input.assigneeIds) {
      await tx.taskAssignee.deleteMany({ where: { taskId: id } });
      await tx.taskAssignee.createMany({
        data: input.assigneeIds.map((userId) => ({ taskId: id, userId })),
        skipDuplicates: true
      });
    }

    if (input.followerIds) {
      await tx.taskFollower.deleteMany({ where: { taskId: id } });
      await tx.taskFollower.createMany({
        data: input.followerIds.map((userId) => ({ taskId: id, userId })),
        skipDuplicates: true
      });
    }

    if (input.tagIds) {
      await tx.taskTag.deleteMany({ where: { taskId: id } });
      await tx.taskTag.createMany({
        data: input.tagIds.map((tagId) => ({ taskId: id, tagId })),
        skipDuplicates: true
      });
    }

    await writeAuditLog(tx, {
      actorId: auth.userId,
      action: "task.update",
      entityType: "tasks",
      entityId: id,
      ipAddress
    });

    return updated;
  });
}

export async function updateTaskProgress(
  db: PrismaClient,
  auth: AuthContext,
  id: string,
  input: { progress: number; note?: string },
  ipAddress?: string
) {
  const task = await db.task.findUnique({
    where: { id },
    include: { assignees: true }
  });
  if (!task || task.deletedAt) {
    throw notFound("Không tìm thấy công việc.");
  }
  const isAssignee = task.assignees.some((assignee) => assignee.userId === auth.userId);
  if (!isAssignee && !canEditTask(auth, task)) {
    throw forbidden("Chỉ người thực hiện, người giao, người tạo hoặc quản lý công việc được cập nhật tiến độ.");
  }

  const newStatus = nextStatusAfterProgress({
    currentStatus: task.status,
    progress: input.progress,
    requiresReview: task.requiresReview
  });

  return db.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id },
      data: {
        progress: input.progress,
        status: newStatus,
        version: { increment: 1 }
      }
    });

    await tx.taskProgressLog.create({
      data: {
        taskId: id,
        userId: auth.userId,
        progress: input.progress,
        note: input.note,
        oldStatus: task.status,
        newStatus
      }
    });

    await writeAuditLog(tx, {
      actorId: auth.userId,
      action: "task.progress.update",
      entityType: "tasks",
      entityId: id,
      ipAddress,
      metadata: { progress: input.progress, oldStatus: task.status, newStatus }
    });

    if (newStatus === "PENDING_REVIEW") {
      const reviewers = [task.creatorId, task.managerId].filter(Boolean) as string[];
      await enqueueNotifications(
        tx,
        reviewers.map((userId) => ({
          userId,
          title: "Công việc chờ đánh giá",
          content: `${task.code} - ${task.title}`,
          type: "TASK_PENDING_REVIEW",
          objectType: "task",
          objectId: task.id,
          link: `/tasks/${task.id}`
        }))
      );
    }

    return updated;
  });
}

export async function evaluateTask(
  db: PrismaClient,
  auth: AuthContext,
  id: string,
  input: { accepted: boolean; rating?: number; comment?: string; attachmentIds?: string[] },
  ipAddress?: string
) {
  const task = await db.task.findUnique({
    where: { id },
    include: { assignees: true }
  });
  if (!task || task.deletedAt) {
    throw notFound("Không tìm thấy công việc.");
  }
  if (!canEditTask(auth, task) && !hasPermission(auth, "task.evaluate")) {
    throw forbidden("Bạn không có quyền đánh giá công việc này.");
  }
  if (input.accepted && (!input.rating || input.rating < 1 || input.rating > 5)) {
    throw badRequest("Khi xác nhận hoàn thành cần chấm chất lượng từ 1 đến 5 sao.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id },
      data: {
        status: input.accepted ? "DONE" : "IN_PROGRESS",
        progress: input.accepted ? 100 : task.progress,
        version: { increment: 1 }
      }
    });

    await tx.taskEvaluation.create({
      data: {
        taskId: id,
        evaluatorId: auth.userId,
        accepted: input.accepted,
        rating: input.rating,
        comment: input.comment,
        attachmentIds: input.attachmentIds ?? []
      }
    });

    await writeAuditLog(tx, {
      actorId: auth.userId,
      action: input.accepted ? "task.evaluate.accept" : "task.evaluate.redo",
      entityType: "tasks",
      entityId: id,
      ipAddress
    });

    if (!input.accepted) {
      await enqueueNotifications(
        tx,
        task.assignees.map((assignee) => ({
          userId: assignee.userId,
          title: "Công việc cần thực hiện lại",
          content: `${task.code} - ${task.title}`,
          type: "TASK_REDO_REQUESTED",
          objectType: "task",
          objectId: task.id,
          link: `/tasks/${task.id}`
        }))
      );
    }

    return updated;
  });
}

export async function addTaskComment(
  db: PrismaClient,
  auth: AuthContext,
  id: string,
  input: { content: string; parentCommentId?: string; mentions?: string[]; attachmentIds?: string[] },
  ipAddress?: string
) {
  await ensureCanReadTask(db, auth, id);
  if (!hasPermission(auth, "task.comment")) {
    throw forbidden("Bạn không có quyền bình luận.");
  }

  return db.$transaction(async (tx) => {
    if (input.attachmentIds?.length) {
      const attachmentCount = await tx.taskAttachment.count({
        where: {
          id: { in: input.attachmentIds },
          taskId: id,
          uploadedById: auth.userId,
          commentId: null,
          deletedAt: null
        }
      });
      if (attachmentCount !== input.attachmentIds.length) {
        throw badRequest("Tệp đính kèm không hợp lệ hoặc đã được gắn với bình luận khác.");
      }
    }

    const comment = await tx.taskComment.create({
      data: {
        taskId: id,
        authorId: auth.userId,
        content: input.content,
        parentCommentId: input.parentCommentId,
        mentions: input.mentions ?? []
      }
    });

    if (input.attachmentIds?.length) {
      await tx.taskAttachment.updateMany({
        where: { id: { in: input.attachmentIds }, taskId: id, uploadedById: auth.userId },
        data: { commentId: comment.id }
      });
    }

    await writeAuditLog(tx, {
      actorId: auth.userId,
      action: "task.comment.create",
      entityType: "task_comments",
      entityId: comment.id,
      ipAddress
    });

    await enqueueNotifications(
      tx,
      (input.mentions ?? []).map((userId) => ({
        userId,
        title: "Bạn được nhắc tên trong bình luận",
        content: input.content.slice(0, 160),
        type: "MENTION",
        objectType: "task",
        objectId: id,
        link: `/tasks/${id}`
      }))
    );

    return comment;
  });
}

export async function listTaskCategories(db: PrismaClient) {
  return db.taskCategory.findMany({ orderBy: { name: "asc" } });
}

export async function listTags(db: PrismaClient) {
  return db.tag.findMany({ orderBy: { name: "asc" } });
}
