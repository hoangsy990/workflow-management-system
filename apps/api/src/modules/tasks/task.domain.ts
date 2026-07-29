import type { TaskStatus } from "@prisma/client";

export const terminalTaskStatuses: TaskStatus[] = ["DONE", "CANCELLED"];

export function isTerminalTaskStatus(status: TaskStatus): boolean {
  return terminalTaskStatuses.includes(status);
}

export function isTaskOverdue(input: { status: TaskStatus; dueDate: Date | string | null; now?: Date }): boolean {
  if (!input.dueDate || isTerminalTaskStatus(input.status)) {
    return false;
  }
  const due = input.dueDate instanceof Date ? input.dueDate : new Date(input.dueDate);
  return due.getTime() < (input.now ?? new Date()).getTime();
}

export function nextStatusAfterProgress(input: {
  currentStatus: TaskStatus;
  progress: number;
  requiresReview: boolean;
}): TaskStatus {
  if (input.progress < 0 || input.progress > 100) {
    throw new RangeError("Progress must be between 0 and 100.");
  }

  if (input.currentStatus === "CANCELLED" || input.currentStatus === "DONE") {
    return input.currentStatus;
  }

  if (input.progress === 100) {
    return input.requiresReview ? "PENDING_REVIEW" : "DONE";
  }

  if (input.progress > 0) {
    return "IN_PROGRESS";
  }

  return input.currentStatus === "DRAFT" ? "DRAFT" : "TODO";
}

export function daysRemaining(dueDate: Date | string | null, now = new Date()): number | null {
  if (!dueDate) {
    return null;
  }
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
  const diff = due.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export async function assertNoTaskCycle(
  taskId: string,
  parentTaskId: string | null | undefined,
  getParentId: (taskId: string) => Promise<string | null>
) {
  if (!parentTaskId) {
    return;
  }

  let current: string | null = parentTaskId;
  const visited = new Set<string>();

  while (current) {
    if (current === taskId || visited.has(current)) {
      throw new Error("Không được tạo quan hệ công việc cha/con dạng vòng lặp.");
    }
    visited.add(current);
    current = await getParentId(current);
  }
}

