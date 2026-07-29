export const DATE_FORMAT = "dd/MM/yyyy";
export const DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";

export const permissionCodes = [
  "user.read",
  "user.manage",
  "department.read",
  "department.manage",
  "role.read",
  "role.manage",
  "task.create",
  "task.read_all",
  "task.read_team",
  "task.update_any",
  "task.assign",
  "task.evaluate",
  "task.comment",
  "workflow.template.manage",
  "workflow.instance.create",
  "workflow.instance.approve",
  "workflow.instance.read_all",
  "notification.read",
  "audit.read",
  "setting.manage"
] as const;

export type PermissionCode = (typeof permissionCodes)[number];

export const taskStatuses = [
  "DRAFT",
  "TODO",
  "IN_PROGRESS",
  "PAUSED",
  "PENDING_REVIEW",
  "DONE",
  "CANCELLED"
] as const;

export type TaskStatus = (typeof taskStatuses)[number];

export const workflowInstanceStatuses = [
  "DRAFT",
  "SUBMITTED",
  "IN_PROGRESS",
  "NEEDS_INFO",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "COMPLETED"
] as const;

export type WorkflowInstanceStatus = (typeof workflowInstanceStatuses)[number];

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
