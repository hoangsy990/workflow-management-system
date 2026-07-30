import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;
const taskDeadlineHorizonMs = 3 * 24 * 60 * 60 * 1000;
const workflowDefaultReminderHours = 24;

export interface NotificationEvent {
  userId: string;
  title: string;
  content: string;
  type: string;
  objectType?: string;
  objectId?: string;
  link?: string;
}

export async function enqueueNotifications(db: Db, events: NotificationEvent[]) {
  if (events.length === 0) {
    return;
  }

  await db.notification.createMany({
    data: events.map((event) => ({
      userId: event.userId,
      title: event.title,
      content: event.content,
      type: event.type,
      objectType: event.objectType,
      objectId: event.objectId,
      link: event.link
    }))
  });
}

async function enqueueUniqueNotification(db: Db, event: NotificationEvent) {
  const existing = await db.notification.findFirst({
    where: {
      userId: event.userId,
      type: event.type,
      objectType: event.objectType,
      objectId: event.objectId
    },
    select: { id: true }
  });

  if (existing) {
    return false;
  }

  await enqueueNotifications(db, [event]);
  return true;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function uniqueIds(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))];
}

export async function runDeadlineNotificationScan(db: Db, now = new Date()) {
  const openTaskStatuses = ["DRAFT", "TODO", "IN_PROGRESS", "PAUSED", "PENDING_REVIEW"] as const;
  const dueSoonEnd = new Date(now.getTime() + taskDeadlineHorizonMs);
  let created = 0;

  const [dueSoonTasks, overdueTasks] = await Promise.all([
    db.task.findMany({
      where: {
        deletedAt: null,
        status: { in: [...openTaskStatuses] },
        dueDate: { gte: now, lte: dueSoonEnd }
      },
      include: {
        assignees: { select: { userId: true } },
        followers: { select: { userId: true } }
      }
    }),
    db.task.findMany({
      where: {
        deletedAt: null,
        status: { in: [...openTaskStatuses] },
        dueDate: { lt: now }
      },
      include: {
        assignees: { select: { userId: true } },
        followers: { select: { userId: true } }
      }
    })
  ]);

  for (const task of dueSoonTasks) {
    const recipients = uniqueIds([
      task.creatorId,
      task.assignerId,
      task.managerId,
      ...task.assignees.map((assignee) => assignee.userId),
      ...task.followers.map((follower) => follower.userId)
    ]);
    for (const userId of recipients) {
      if (
        await enqueueUniqueNotification(db, {
          userId,
          title: "Công việc sắp đến hạn",
          content: `${task.code} - ${task.title}`,
          type: "TASK_DUE_SOON",
          objectType: "task",
          objectId: task.id,
          link: `/tasks/${task.id}`
        })
      ) {
        created += 1;
      }
    }
  }

  for (const task of overdueTasks) {
    const recipients = uniqueIds([
      task.creatorId,
      task.assignerId,
      task.managerId,
      ...task.assignees.map((assignee) => assignee.userId),
      ...task.followers.map((follower) => follower.userId)
    ]);
    for (const userId of recipients) {
      if (
        await enqueueUniqueNotification(db, {
          userId,
          title: "Công việc đã quá hạn",
          content: `${task.code} - ${task.title}`,
          type: "TASK_OVERDUE",
          objectType: "task",
          objectId: task.id,
          link: `/tasks/${task.id}`
        })
      ) {
        created += 1;
      }
    }
  }

  const workflowSteps = await db.workflowInstanceStep.findMany({
    where: {
      status: "PENDING",
      deadlineAt: { lte: addDays(now, 3) }
    },
    include: {
      step: true,
      instance: { select: { id: true, code: true, deletedAt: true } },
      approvals: {
        where: { status: "PENDING" },
        select: { approverId: true }
      }
    }
  });

  for (const instanceStep of workflowSteps) {
    if (!instanceStep.deadlineAt || instanceStep.instance.deletedAt) {
      continue;
    }

    const overdue = instanceStep.deadlineAt <= now;
    const reminderHours = instanceStep.step.reminderBeforeHours ?? workflowDefaultReminderHours;
    const dueSoon = !overdue && instanceStep.deadlineAt <= addHours(now, reminderHours);
    if (!overdue && !dueSoon) {
      continue;
    }

    const type = overdue ? "WORKFLOW_STEP_OVERDUE" : "WORKFLOW_STEP_DUE_SOON";
    const title = overdue ? "Bước phê duyệt đã quá hạn" : "Bước phê duyệt sắp quá hạn";
    const recipients = uniqueIds(instanceStep.approvals.map((approval) => approval.approverId));
    for (const userId of recipients) {
      if (
        await enqueueUniqueNotification(db, {
          userId,
          title,
          content: `${instanceStep.instance.code} - ${instanceStep.step.name}`,
          type,
          objectType: "workflow_instance_step",
          objectId: instanceStep.id,
          link: `/workflows/instances/${instanceStep.instance.id}`
        })
      ) {
        created += 1;
      }
    }
  }

  return {
    ok: true,
    created,
    scanned: {
      dueSoonTasks: dueSoonTasks.length,
      overdueTasks: overdueTasks.length,
      workflowSteps: workflowSteps.length
    }
  };
}
