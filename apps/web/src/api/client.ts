const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

export interface ApiSession {
  accessToken: string;
  refreshToken: string;
}

export interface ApiUser {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  title?: string | null;
  permissions: string[];
  roles: Array<{ code: string; name: string }>;
  department?: { id: string; name: string; code: string } | null;
}

export interface Paginated<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiErrorShape {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

const sessionKey = "workflow.session";
let refreshPromise: Promise<ApiSession | null> | null = null;

class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function getStoredSession(): ApiSession | null {
  const value = sessionStorage.getItem(sessionKey);
  return value ? (JSON.parse(value) as ApiSession) : null;
}

export function setStoredSession(session: ApiSession | null) {
  if (!session) {
    sessionStorage.removeItem(sessionKey);
    return;
  }
  sessionStorage.setItem(sessionKey, JSON.stringify(session));
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const apiError = data as ApiErrorShape;
    throw new ApiRequestError(
      response.status,
      apiError.error?.code ?? "REQUEST_ERROR",
      apiError.error?.message ?? "Yêu cầu API thất bại.",
      apiError.error?.details
    );
  }
  return data as T;
}

function buildHeaders(options: RequestInit, session: ApiSession | null) {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }
  return headers;
}

async function refreshStoredSession(): Promise<ApiSession | null> {
  const session = getStoredSession();
  if (!session?.refreshToken) {
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refreshToken: session.refreshToken })
    })
      .then(async (response) => {
        const data = await parseResponse<{ accessToken: string }>(response);
        const nextSession = { ...session, accessToken: data.accessToken };
        setStoredSession(nextSession);
        return nextSession;
      })
      .catch((error) => {
        setStoredSession(null);
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const session = getStoredSession();
  const headers = buildHeaders(options, session);

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  if (response.status === 401 && session?.refreshToken && !path.startsWith("/auth/") && !retried) {
    await refreshStoredSession();
    return apiRequest<T>(path, options, true);
  }

  return parseResponse<T>(response);
}

async function parseBlobResponse(response: Response): Promise<{ blob: Blob; filename: string }> {
  if (!response.ok) {
    await parseResponse<never>(response);
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const encodedName = disposition.match(/filename="([^"]+)"/)?.[1];
  return {
    blob: await response.blob(),
    filename: encodedName ? decodeURIComponent(encodedName) : ""
  };
}

export async function apiBlobRequest(path: string, options: RequestInit = {}, retried = false): Promise<{ blob: Blob; filename: string }> {
  const session = getStoredSession();
  const headers = buildHeaders(options, session);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  if (response.status === 401 && session?.refreshToken && !path.startsWith("/auth/") && !retried) {
    await refreshStoredSession();
    return apiBlobRequest(path, options, true);
  }

  return parseBlobResponse(response);
}

export const api = {
  login: (email: string, password: string, deviceName = "Web") =>
    apiRequest<{ user: ApiUser; accessToken: string; refreshToken: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, deviceName })
    }),
  me: () => apiRequest<ApiUser>("/auth/me"),
  logout: (refreshToken?: string) =>
    apiRequest<{ ok: true }>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken })
    }),
  dashboard: () => apiRequest<Record<string, any>>("/dashboard"),
  notifications: () => apiRequest<Paginated<Record<string, any>> & { unread: number }>("/notifications?pageSize=8"),
  readNotification: (id: string) => apiRequest<{ ok: true }>(`/notifications/${id}/read`, { method: "POST" }),
  users: () => apiRequest<Paginated<Record<string, any>>>("/users?pageSize=100"),
  createUser: (payload: Record<string, unknown>) =>
    apiRequest<Record<string, any>>("/users", { method: "POST", body: JSON.stringify(payload) }),
  departments: () => apiRequest<Record<string, any>[]>("/departments"),
  saveDepartment: (payload: Record<string, unknown>) =>
    apiRequest<Record<string, any>>("/departments", { method: "POST", body: JSON.stringify(payload) }),
  roles: () => apiRequest<Record<string, any>[]>("/roles"),
  permissions: () => apiRequest<Record<string, any>[]>("/permissions"),
  updateRolePermissions: (id: string, permissionIds: string[]) =>
    apiRequest<Record<string, any>>(`/roles/${id}/permissions`, { method: "PUT", body: JSON.stringify({ permissionIds }) }),
  taskCategories: () => apiRequest<Record<string, any>[]>("/task-categories"),
  tags: () => apiRequest<Record<string, any>[]>("/tags"),
  tasks: (query = "") => apiRequest<Paginated<Record<string, any>>>(`/tasks${query}`),
  task: (id: string) => apiRequest<Record<string, any>>(`/tasks/${id}`),
  createTask: (payload: Record<string, unknown>) =>
    apiRequest<Record<string, any>>("/tasks", { method: "POST", body: JSON.stringify(payload) }),
  updateTask: (id: string, payload: Record<string, unknown>) =>
    apiRequest<Record<string, any>>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  updateTaskProgress: (id: string, progress: number, note?: string) =>
    apiRequest<Record<string, any>>(`/tasks/${id}/progress`, {
      method: "POST",
      body: JSON.stringify({ progress, note })
    }),
  evaluateTask: (id: string, payload: Record<string, unknown>) =>
    apiRequest<Record<string, any>>(`/tasks/${id}/evaluations`, { method: "POST", body: JSON.stringify(payload) }),
  commentTask: (id: string, payload: Record<string, unknown>) =>
    apiRequest<Record<string, any>>(`/tasks/${id}/comments`, { method: "POST", body: JSON.stringify(payload) }),
  uploadTaskAttachment: (id: string, file: File) => {
    const form = new FormData();
    form.set("file", file);
    return apiRequest<Record<string, any>>(`/tasks/${id}/attachments`, { method: "POST", body: form });
  },
  downloadAttachment: (id: string) => apiBlobRequest(`/attachments/${id}/download`),
  workflowTemplates: () => apiRequest<Record<string, any>[]>("/workflow-templates"),
  workflowTemplate: (id: string) => apiRequest<Record<string, any>>(`/workflow-templates/${id}`),
  createWorkflowTemplate: (payload: Record<string, unknown>) =>
    apiRequest<Record<string, any>>("/workflow-templates", { method: "POST", body: JSON.stringify(payload) }),
  workflowInstances: (query = "") => apiRequest<Paginated<Record<string, any>>>(`/workflow-instances${query}`),
  workflowInstance: (id: string) => apiRequest<Record<string, any>>(`/workflow-instances/${id}`),
  submitWorkflowInstance: (payload: Record<string, unknown>) =>
    apiRequest<Record<string, any>>("/workflow-instances", { method: "POST", body: JSON.stringify(payload) }),
  actWorkflow: (id: string, payload: Record<string, unknown>) =>
    apiRequest<Record<string, any>>(`/workflow-instances/${id}/actions`, { method: "POST", body: JSON.stringify(payload) }),
  activityLogs: () => apiRequest<Paginated<Record<string, any>>>("/activity-logs?pageSize=50"),
  settings: () => apiRequest<Record<string, any>[]>("/system-settings"),
  saveSetting: (payload: Record<string, unknown>) =>
    apiRequest<Record<string, any>>("/system-settings", { method: "PUT", body: JSON.stringify(payload) })
};
