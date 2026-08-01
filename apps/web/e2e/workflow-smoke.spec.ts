import { expect, test, type APIRequestContext, type APIResponse, type Page } from "@playwright/test";

const apiUrl = (process.env.E2E_API_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "");
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test.setTimeout(120_000);

const accounts = {
  admin: { email: "admin@workflow.local", password: "Admin@123456" },
  manager: { email: "manager@workflow.local", password: "Manager@123456" },
  employee: { email: "lan@workflow.local", password: "Demo@123456" }
} as const;
const defaultUploadMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "video/mp4"
];

type AccountKey = keyof typeof accounts;

interface ApiSession {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    department?: { id: string; name: string } | null;
  };
}

interface Paginated<T> {
  data: T[];
}

interface UserRecord {
  id: string;
  employeeCode: string;
  email: string;
  fullName: string;
  phone?: string | null;
  title?: string | null;
  department?: { id: string; name: string } | null;
}

interface DepartmentRecord {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  parent?: { id: string; name: string } | null;
  manager?: { id: string; fullName: string } | null;
}

interface TeamRecord {
  id: string;
  code: string;
  name: string;
  department?: { id: string; name: string } | null;
  members?: Array<{ user: { id: string; fullName: string } }>;
}

interface TaskRecord {
  id: string;
  code: string;
  title: string;
}

interface TaskDetailRecord extends TaskRecord {
  status?: string;
  progress?: number;
  subTaskProgress?: number | null;
  assigner?: { id: string; fullName: string } | null;
  parentTask?: { id: string; code: string; title: string } | null;
  dependenciesFrom?: Array<{ targetTask?: { id: string; code: string; title: string } | null }>;
  attachments?: Array<{ id: string; originalName: string }>;
  comments?: Array<{ id: string; content: string; parentCommentId?: string | null }>;
  evaluations?: Array<{ attachmentIds?: string[]; comment?: string | null; rating?: number | null }>;
}

interface TaskCategoryRecord {
  id: string;
  name: string;
}

interface TagRecord {
  id: string;
  name: string;
}

interface UploadConfigRecord {
  maxMb: number;
  allowedMimeTypes: string[];
  accept: string;
}

interface WorkflowTemplateRecord {
  id: string;
  code: string;
  name: string;
  versions?: Array<{
    id: string;
    versionNo: number;
    status?: string;
    fields?: Array<{
      code: string;
      defaultValue?: unknown;
      validation?: Record<string, unknown> | null;
    }>;
    steps?: Array<{
      code: string;
      approvalMode?: string | null;
      completionRule?: string | null;
      minCount?: number | null;
      minPercent?: number | null;
    }>;
    transitions?: Array<{
      fromStep?: { code: string };
      toStep?: { code: string };
      conditions?: Array<{ fieldCode: string; operator: string; compareValue: unknown }>;
    }>;
  }>;
}

interface WorkflowInstanceRecord {
  id: string;
  code: string;
  status: string;
}

interface WorkflowInstanceDetailRecord extends WorkflowInstanceRecord {
  workflowVersion?: {
    steps?: Array<{ id: string; code: string; name: string }>;
    transitions?: Array<{ id: string; fromStepId: string; toStepId: string }>;
  };
  approvals?: Array<{
    id: string;
    action?: string | null;
    status: string;
    approver?: { id: string; fullName: string };
    attachments?: Array<{ id: string; originalName: string }>;
  }>;
}

const sessionCache = new Map<AccountKey, ApiSession>();
let paymentTemplateCache: WorkflowTemplateRecord | null = null;

test.describe.configure({ mode: "serial" });

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uniqueSlug(label: string) {
  return `${label}-${runId}-${Math.random().toString(36).slice(2, 8)}`;
}

function dateInput(daysFromNow: number) {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function parseApi<T>(response: APIResponse): Promise<T> {
  const text = await response.text();
  if (!response.ok()) {
    throw new Error(`API ${response.status()} ${response.url()}: ${text}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

async function parseApiWithRetry<T>(requester: () => Promise<APIResponse>): Promise<T> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await requester();
    if (response.status() === 429 && attempt < 5) {
      const text = await response.text();
      const retrySeconds = Number(text.match(/retry in (\d+) seconds/i)?.[1] ?? 5);
      await wait(Math.min(retrySeconds * 1000 + 1000, 60_000));
      continue;
    }
    return parseApi<T>(response);
  }
  throw new Error("API retry attempts exhausted");
}

async function rawLoginWithRetry(request: APIRequestContext, email: string, password: string, deviceName: string): Promise<APIResponse> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await request.post(`${apiUrl}/auth/login`, {
      data: { email, password, deviceName }
    });
    if (response.status() === 429 && attempt < 5) {
      const text = await response.text();
      const retrySeconds = Number(text.match(/retry in (\d+) seconds/i)?.[1] ?? 5);
      await wait(Math.min(retrySeconds * 1000 + 1000, 60_000));
      continue;
    }
    return response;
  }
  throw new Error("Login retry attempts exhausted");
}

function authHeaders(session: ApiSession) {
  return {
    Authorization: `Bearer ${session.accessToken}`
  };
}

async function apiLogin(request: APIRequestContext, account: AccountKey): Promise<ApiSession> {
  const cached = sessionCache.get(account);
  if (cached) return cached;

  const credentials = accounts[account];
  const session = await parseApiWithRetry<ApiSession>(() =>
    request.post(`${apiUrl}/auth/login`, {
      data: {
        email: credentials.email,
        password: credentials.password,
        deviceName: "Playwright smoke"
      }
    })
  );
  sessionCache.set(account, session);
  return session;
}

async function apiGet<T>(request: APIRequestContext, session: ApiSession, path: string): Promise<T> {
  return parseApiWithRetry<T>(() =>
    request.get(`${apiUrl}${path}`, {
      headers: authHeaders(session)
    })
  );
}

async function apiPost<T>(request: APIRequestContext, session: ApiSession, path: string, data: unknown): Promise<T> {
  return parseApiWithRetry<T>(() =>
    request.post(`${apiUrl}${path}`, {
      headers: authHeaders(session),
      data
    })
  );
}

async function apiPut<T>(request: APIRequestContext, session: ApiSession, path: string, data: unknown): Promise<T> {
  return parseApiWithRetry<T>(() =>
    request.put(`${apiUrl}${path}`, {
      headers: authHeaders(session),
      data
    })
  );
}

async function openAppWithSession(page: Page, session: ApiSession) {
  await page.goto("/");
  await page.evaluate((storedSession) => {
    window.sessionStorage.clear();
    window.sessionStorage.setItem(
      "workflow.session",
      JSON.stringify({
        accessToken: storedSession.accessToken,
        refreshToken: storedSession.refreshToken
      })
    );
  }, session);
  await page.reload({ waitUntil: "domcontentloaded" });
  try {
    await expect(page.getByTestId("nav-dashboard")).toBeVisible({ timeout: 1500 });
  } catch {
    await expect(page.getByTestId("bottom-nav-dashboard")).toBeVisible();
  }
}

async function createSmokeTask(
  request: APIRequestContext,
  manager: ApiSession,
  label = "upload",
  overrides: Record<string, unknown> = {}
) {
  const users = await apiGet<Paginated<UserRecord>>(request, manager, "/users?pageSize=100");
  const departments = await apiGet<DepartmentRecord[]>(request, manager, "/departments");
  const assignee = users.data.find((user) => user.email === accounts.employee.email) ?? users.data[0];
  const department = assignee?.department ?? departments[0];
  const slug = uniqueSlug(label);

  expect(assignee, "Seed employee is required").toBeTruthy();
  expect(department, "Seed department is required").toBeTruthy();

  return apiPost<TaskRecord>(request, manager, "/tasks", {
    title: `Smoke ${label} ${slug}`,
    description: "Task created by Playwright smoke test.",
    managerId: manager.user.id,
    assigneeIds: [assignee!.id],
    followerIds: [],
    departmentId: department!.id,
    startDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    priority: "NORMAL",
    tagIds: [],
    requiresReview: true,
    ...overrides
  });
}

async function createSmokeWorkflowInstance(
  request: APIRequestContext,
  employee: ApiSession,
  label = "approval",
  formOverrides: Record<string, unknown> = {}
) {
  const paymentTemplate = await getPaymentTemplate(request, employee);
  const slug = uniqueSlug(label);

  return apiPost<WorkflowInstanceRecord>(request, employee, "/workflow-instances", {
    templateId: paymentTemplate.id,
    formData: {
      purpose: `Smoke ${label} ${slug}`,
      amount: 12_000_000,
      vendor: "Playwright Vendor",
      ...formOverrides
    },
    idempotencyKey: `smoke-instance-${slug}`
  });
}

async function getPaymentTemplate(request: APIRequestContext, session: ApiSession) {
  if (paymentTemplateCache) {
    return paymentTemplateCache;
  }
  const templates = await apiGet<WorkflowTemplateRecord[]>(request, session, "/workflow-templates");
  const paymentTemplate = templates.find((template) => template.code === "PAYMENT") ?? templates[0];
  expect(paymentTemplate, "Seed payment workflow template is required").toBeTruthy();
  paymentTemplateCache = paymentTemplate!;
  return paymentTemplateCache;
}

async function openWorkflowApproval(page: Page, manager: ApiSession, instance: WorkflowInstanceRecord) {
  await openAppWithSession(page, manager);
  await page.getByTestId("nav-approvals").click();
  const row = page.locator(`tr[data-testid="workflow-instance-row-${instance.id}"]`);
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByRole("heading", { name: instance.code })).toBeVisible();
}

async function runWorkflowAction(
  page: Page,
  testId: string,
  comment: string,
  transferToUserId?: string,
  attachment?: { name: string; mimeType: string; buffer: Buffer }
) {
  await page.getByTestId(testId).click();
  await expect(page.getByTestId("workflow-action-panel")).toBeVisible();
  if (transferToUserId) {
    const transferSelect = page.getByTestId("workflow-action-transfer-user");
    await expect(transferSelect.locator(`option[value="${transferToUserId}"]`)).toHaveCount(1);
    await transferSelect.selectOption(transferToUserId);
  }
  if (attachment) {
    await page.getByTestId("workflow-action-attachment-input").setInputFiles(attachment);
    await expect(page.getByTestId("workflow-action-attachment-list")).toContainText(attachment.name);
  }
  await page.getByTestId("workflow-action-comment").fill(comment);
  const uploadResponse = attachment
    ? page.waitForResponse(
        (response) =>
          response.url().includes("/workflow-instances/") &&
          response.url().endsWith("/attachments") &&
          response.request().method() === "POST"
      )
    : null;
  const actionResponse = page.waitForResponse(
    (response) => response.url().includes("/workflow-instances/") && response.url().endsWith("/actions") && response.request().method() === "POST"
  );
  await page.getByTestId("workflow-action-confirm").click();
  if (uploadResponse) {
    const uploadResult = await uploadResponse;
    expect(uploadResult.ok(), await uploadResult.text()).toBeTruthy();
  }
  const actionResult = await actionResponse;
  expect(actionResult.ok(), await actionResult.text()).toBeTruthy();
}

async function openTaskFromNav(page: Page, navTestId: string, task: TaskRecord, keyword = task.title) {
  await page.getByTestId(navTestId).click();
  await page.getByTestId("task-search-input").fill(keyword);
  const row = page.locator(`tr[data-testid="task-row-${task.id}"]`);
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByRole("heading", { name: task.title })).toBeVisible();
}

test("đăng nhập web bằng tài khoản quản trị", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("login-email").fill(accounts.admin.email);
  await page.getByTestId("login-password").fill(accounts.admin.password);
  await page.getByTestId("login-submit").click();

  await expect(page.getByTestId("nav-dashboard")).toBeVisible();
  await expect(page.getByTestId("nav-tasks")).toBeVisible();
});

test("layout có landmark và ARIA cơ bản cho screen reader", async ({ page, request }) => {
  const admin = await apiLogin(request, "admin");
  await openAppWithSession(page, admin);

  await expect(page.getByRole("link", { name: "Bỏ qua điều hướng" })).toHaveAttribute("href", "#main-content");
  await page.getByRole("link", { name: "Bỏ qua điều hướng" }).focus();
  await expect(page.getByRole("link", { name: "Bỏ qua điều hướng" })).toBeFocused();
  await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toBeVisible();
  await expect(page.getByRole("main", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByTestId("nav-dashboard")).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".sync-pill")).toHaveAttribute("role", "status");

  await page.getByTestId("account-sessions-open").click();
  await expect(page.getByTestId("account-sessions-open")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("dialog", { name: "Phiên đăng nhập" })).toBeVisible();
});

test("mobile bottom nav ưu tiên luồng chính và mở trang thông báo", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const admin = await apiLogin(request, "admin");
  await openAppWithSession(page, admin);

  await expect(page.getByTestId("bottom-nav-dashboard")).toBeVisible();
  await expect(page.getByTestId("bottom-nav-myTasks")).toBeVisible();
  await expect(page.getByTestId("bottom-nav-newTask")).toBeVisible();
  await expect(page.getByTestId("bottom-nav-approvals")).toBeVisible();
  await expect(page.getByTestId("bottom-nav-notifications")).toBeVisible();
  await expect(page.getByTestId("bottom-nav-profile")).toBeVisible();

  await page.getByTestId("bottom-nav-notifications").click();
  await expect(page.getByTestId("notifications-page")).toBeVisible();
  await expect(page.getByTestId("bottom-nav-notifications")).toHaveAttribute("aria-current", "page");

  await page.getByTestId("bottom-nav-newTask").click();
  await expect(page.getByTestId("task-create-title")).toBeVisible();
});

test("mobile mở bộ lọc công việc dạng bottom sheet và lọc bằng API thật", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const manager = await apiLogin(request, "manager");
  const employee = await apiLogin(request, "employee");
  const task = await createSmokeTask(request, manager, "mobile-filter");

  await openAppWithSession(page, employee);
  await page.getByTestId("bottom-nav-myTasks").click();
  await page.getByTestId("task-filter-toggle").click();

  const panel = page.getByTestId("task-filter-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute("role", "dialog");
  await expect(page.getByTestId("task-filter-close")).toBeVisible();

  const filteredResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith("/tasks") && url.searchParams.get("code") === task.code;
  });
  await page.getByTestId("task-filter-code").fill(task.code);
  const response = await filteredResponse;
  expect(response.ok(), await response.text()).toBeTruthy();

  await page.getByTestId("task-filter-apply").click();
  await expect(panel).not.toBeVisible();
  await expect(page.getByTestId("task-filter-toggle")).toContainText("(1)");
  await expect(page.getByTestId(`task-row-${task.id}-mobile`)).toBeVisible();

  await page.getByTestId("task-filter-toggle").click();
  await page.getByTestId("task-filter-backdrop").click({ position: { x: 20, y: 20 } });
  await expect(panel).not.toBeVisible();
});

test("offline banner hiển thị rõ khi mất kết nối", async ({ page, request, context }) => {
  const admin = await apiLogin(request, "admin");
  await openAppWithSession(page, admin);

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByTestId("offline-banner")).toBeVisible();

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByTestId("offline-banner")).not.toBeVisible();
});

test("global search tìm và mở đúng công việc, hồ sơ, người dùng", async ({ page, request }) => {
  const admin = await apiLogin(request, "admin");
  const manager = await apiLogin(request, "manager");
  const employee = await apiLogin(request, "employee");
  const task = await createSmokeTask(request, manager, "global-search");
  const instance = await createSmokeWorkflowInstance(request, employee, "global-search");

  await openAppWithSession(page, admin);
  await page.getByTestId("global-search-input").fill(task.title);
  await expect(page.getByTestId(`global-search-result-tasks-${task.id}`)).toBeVisible();
  await page.getByTestId(`global-search-result-tasks-${task.id}`).click();
  await expect(page.getByRole("heading", { name: task.title })).toBeVisible();

  await page.getByTestId("global-search-input").fill(instance.code);
  await expect(page.getByTestId(`global-search-result-workflowInstances-${instance.id}`)).toBeVisible();
  await page.getByTestId(`global-search-result-workflowInstances-${instance.id}`).click();
  await expect(page.getByRole("heading", { name: instance.code })).toBeVisible();

  await page.getByTestId("global-search-input").fill(employee.user.email);
  await expect(page.getByTestId(`global-search-result-users-${employee.user.id}`)).toBeVisible();
  await page.getByTestId(`global-search-result-users-${employee.user.id}`).click();
  await expect(page.getByTestId("nav-users")).toHaveAttribute("aria-current", "page");
});

test("xem, thu hồi phiên thiết bị và đăng xuất tất cả", async ({ page, request }) => {
  const admin = await apiLogin(request, "admin");
  const deviceName = `Smoke device ${runId}`;
  const extraSession = await parseApiWithRetry<ApiSession>(() =>
    request.post(`${apiUrl}/auth/login`, {
      data: {
        email: accounts.admin.email,
        password: accounts.admin.password,
        deviceName
      }
    })
  );

  await openAppWithSession(page, admin);
  await page.getByTestId("account-sessions-open").click();
  const panel = page.getByTestId("auth-session-panel");
  await expect(panel).toContainText(deviceName);
  const row = panel.locator(".session-row").filter({ hasText: deviceName });
  await row.getByRole("button", { name: "Thu hồi" }).click();
  await expect(panel).not.toContainText(deviceName);

  const refresh = await request.post(`${apiUrl}/auth/refresh`, {
    data: { refreshToken: extraSession.refreshToken }
  });
  expect(refresh.status()).toBe(401);

  await page.getByTestId("auth-session-logout-all").click();
  await page.getByTestId("auth-session-logout-all-confirm").click();
  await expect(page.getByTestId("login-submit")).toBeVisible();

  const currentRefresh = await request.post(`${apiUrl}/auth/refresh`, {
    data: { refreshToken: admin.refreshToken }
  });
  expect(currentRefresh.status()).toBe(401);
});

test("người dùng cập nhật hồ sơ cá nhân trên UI", async ({ page, request }) => {
  const manager = await apiLogin(request, "manager");
  const employee = await apiLogin(request, "employee");
  const nextTitle = `Profile smoke ${runId}`;
  const nextPhone = `091${String(Date.now()).slice(-7)}`;
  const relatedTask = await createSmokeTask(request, manager, "profile-related", {
    startDate: new Date(Date.now() - 120_000).toISOString(),
    dueDate: new Date(Date.now() - 60_000).toISOString()
  });
  const relatedWorkflow = await createSmokeWorkflowInstance(request, employee, "profile-related");

  await openAppWithSession(page, manager);
  await page.getByTestId("account-profile-open").click();
  await expect(page.getByTestId("profile-form")).toBeVisible();
  await expect(page.getByTestId("profile-related")).toBeVisible();
  await expect(page.getByTestId("profile-related-tasks")).toContainText(relatedTask.code);
  await expect(page.getByTestId("profile-related-pending-workflows")).toContainText(relatedWorkflow.code);
  await page.getByTestId("profile-avatar-file").setInputFiles({
    name: `avatar-${runId}.png`,
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64"
    )
  });
  const avatarResponse = page.waitForResponse((response) => response.url().endsWith("/profile/avatar") && response.request().method() === "POST");
  await page.getByTestId("profile-avatar-upload").click();
  expect((await avatarResponse).ok()).toBe(true);
  await expect(page.getByTestId("profile-avatar-success")).toBeVisible();
  await expect(page.getByTestId("profile-avatar-preview")).toBeVisible();
  await page.getByTestId("profile-phone").fill(nextPhone);
  await page.getByTestId("profile-title").fill(nextTitle);
  await page.getByTestId("profile-save").click();
  await expect(page.getByTestId("profile-save-success")).toBeVisible();
  await expect(page.getByTestId("profile-summary")).toContainText(nextTitle);
  await expect(page.getByTestId("profile-activity")).toContainText("user.profile.update");

  const profile = await apiGet<Record<string, any>>(request, manager, "/profile");
  expect(profile.phone).toBe(nextPhone);
  expect(profile.title).toBe(nextTitle);
  expect(profile.avatarUrl).toContain("/api/v1/avatars/");

  const related = await apiGet<Record<string, any>>(request, manager, "/profile/related");
  expect(related.tasks.total).toBeGreaterThan(0);
  expect((related.tasks.data as Array<Record<string, any>>).some((task) => task.id === relatedTask.id)).toBe(true);
  expect((related.workflows.pending.data as Array<Record<string, any>>).some((instance) => instance.id === relatedWorkflow.id)).toBe(true);
});

test("dashboard hiển thị thống kê công việc theo phòng ban", async ({ page, request }) => {
  const manager = await apiLogin(request, "manager");
  const users = await apiGet<Paginated<UserRecord>>(request, manager, "/users?pageSize=100");
  const departments = await apiGet<DepartmentRecord[]>(request, manager, "/departments");
  const assignee = users.data.find((user) => user.email === accounts.employee.email) ?? users.data[0];
  const department = assignee?.department ?? departments[0];

  expect(department, "Seed department is required").toBeTruthy();

  await createSmokeTask(request, manager, "dashboard-department", {
    departmentId: department!.id,
    startDate: `${dateInput(0)}T02:00:00.000Z`,
    dueDate: `${dateInput(2)}T09:00:00.000Z`
  });
  await openAppWithSession(page, manager);
  await page.getByTestId("nav-dashboard").click();

  await expect(page.getByTestId("dashboard-department-stats")).toContainText(department!.name);
  await expect(page.getByTestId("dashboard-status-chart").locator(".bar-meter").first()).toBeVisible();

  await page.getByTestId("dashboard-filter-department").selectOption(department!.id);
  await page.getByTestId("dashboard-filter-from").fill(dateInput(-1));
  await page.getByTestId("dashboard-filter-to").fill(dateInput(5));

  await expect(page.getByTestId("dashboard-department-stats")).toContainText(department!.name);
  await expect(page.getByTestId("dashboard-status-chart").locator(".bar-meter").first()).toBeVisible();
});

test("scheduler gửi thông báo task và bước phê duyệt sắp hạn/quá hạn", async ({ request }) => {
  const admin = await apiLogin(request, "admin");
  const manager = await apiLogin(request, "manager");
  const employee = await apiLogin(request, "employee");
  const dueSoonTask = await createSmokeTask(request, manager, "deadline-due-soon", {
    status: "TODO",
    dueDate: `${dateInput(1)}T09:00:00.000Z`,
    requiresReview: false
  });
  const overdueTask = await createSmokeTask(request, manager, "deadline-overdue", {
    status: "TODO",
    startDate: `${dateInput(-3)}T09:00:00.000Z`,
    dueDate: `${dateInput(-1)}T09:00:00.000Z`,
    requiresReview: false
  });
  const template = await apiPost<WorkflowTemplateRecord>(request, admin, "/workflow-templates", {
    code: `DL-${uniqueSlug("deadline").slice(0, 18)}`,
    name: `Deadline smoke ${runId}`,
    category: "Smoke",
    activate: true,
    fields: [{ name: "Nội dung", code: "purpose", type: "SHORT_TEXT", isRequired: true, displayOrder: 1 }],
    steps: [
      { code: "start", name: "Bắt đầu", type: "START", orderIndex: 1 },
      {
        code: "approve",
        name: "Duyệt có hạn",
        type: "APPROVAL",
        orderIndex: 2,
        approvalMode: "SEQUENTIAL",
        deadlineAmount: 1,
        deadlineUnit: "HOUR",
        reminderBeforeHours: 24,
        assignees: [{ resolverType: "REQUESTER_MANAGER", orderIndex: 1 }]
      },
      { code: "end", name: "Kết thúc", type: "END", orderIndex: 3 }
    ],
    transitions: [{ fromStepCode: "approve", toStepCode: "end", priority: 1 }]
  });
  const instance = await apiPost<WorkflowInstanceRecord>(request, employee, "/workflow-instances", {
    templateId: template.id,
    formData: { purpose: `Deadline workflow ${runId}` },
    idempotencyKey: `smoke-deadline-${uniqueSlug("workflow")}`
  });

  const scan = await apiPost<Record<string, any>>(request, admin, "/notifications/run-deadline-scan", {});
  expect(scan.ok).toBe(true);

  const employeeNotifications = await apiGet<Paginated<Record<string, any>>>(request, employee, "/notifications?pageSize=50");
  expect(employeeNotifications.data.some((notification) => notification.type === "TASK_DUE_SOON" && notification.objectId === dueSoonTask.id)).toBe(true);
  expect(employeeNotifications.data.some((notification) => notification.type === "TASK_OVERDUE" && notification.objectId === overdueTask.id)).toBe(true);

  const managerNotifications = await apiGet<Paginated<Record<string, any>>>(request, manager, "/notifications?pageSize=50");
  expect(managerNotifications.data.some((notification) => notification.type === "WORKFLOW_STEP_DUE_SOON" && String(notification.content).includes(instance.code))).toBe(true);
});

test("admin updates employee profile on UI", async ({ page, request }) => {
  const admin = await apiLogin(request, "admin");
  const users = await apiGet<Paginated<UserRecord>>(request, admin, "/users?pageSize=100");
  const target = users.data.find((user) => user.email === accounts.employee.email) ?? users.data.find((user) => user.email !== accounts.admin.email);
  const nextTitle = `Smoke title ${runId}`;
  const nextPhone = `090${String(Date.now()).slice(-7)}`;

  expect(target, "Seed employee is required").toBeTruthy();

  await openAppWithSession(page, admin);
  await page.getByTestId("nav-users").click();
  const row = page.locator(`tr[data-testid="user-row-${target!.id}"]`);
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByTestId("user-edit-title")).toBeVisible();
  await page.getByTestId("user-edit-title").fill(nextTitle);
  await page.getByTestId("user-edit-phone").fill(nextPhone);

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  const updateResponse = page.waitForResponse((response) => response.url().includes(`/users/${target!.id}`) && response.request().method() === "PATCH");
  await page.getByTestId("user-edit-save").click();
  await updateResponse;

  const refreshed = await apiGet<Paginated<UserRecord>>(request, admin, "/users?pageSize=100");
  const updated = refreshed.data.find((user) => user.id === target!.id);
  expect(updated?.title).toBe(nextTitle);
  expect(updated?.phone).toBe(nextPhone);
});

test("admin updates department structure on UI", async ({ page, request }) => {
  const admin = await apiLogin(request, "admin");
  const departments = await apiGet<DepartmentRecord[]>(request, admin, "/departments");
  const target = departments.find((department) => department.code === "FIN") ?? departments[0];
  const nextDescription = `Smoke department ${runId}`;

  expect(target, "Seed department is required").toBeTruthy();

  await openAppWithSession(page, admin);
  await page.getByTestId("nav-departments").click();
  await expect(page.getByTestId("organization-chart")).toContainText(target!.name);
  await expect(page.getByTestId(`organization-node-${target!.id}`)).toContainText(target!.code);
  await page.getByTestId(`organization-node-${target!.id}`).click();
  const row = page.locator(`tr[data-testid="department-row-${target!.id}"]`);
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByTestId("department-edit-description")).toBeVisible();
  await page.getByTestId("department-edit-description").fill(nextDescription);

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  const updateResponse = page.waitForResponse(
    (response) => response.url().includes(`/departments/${target!.id}`) && response.request().method() === "PATCH"
  );
  await page.getByTestId("department-edit-save").click();
  await updateResponse;

  const refreshed = await apiGet<DepartmentRecord[]>(request, admin, "/departments");
  const updated = refreshed.find((department) => department.id === target!.id);
  expect(updated?.description).toBe(nextDescription);
});

test("admin creates and updates work team on UI", async ({ page, request }) => {
  const admin = await apiLogin(request, "admin");
  const departments = await apiGet<DepartmentRecord[]>(request, admin, "/departments");
  const users = await apiGet<Paginated<UserRecord>>(request, admin, "/users?pageSize=100");
  const department = departments[0];
  const firstMember = users.data.find((user) => user.email === accounts.manager.email) ?? users.data[0];
  const secondMember = users.data.find((user) => user.email === accounts.employee.email) ?? users.data[1];
  const code = `TEAM_${runId.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`;
  const name = `Nhóm smoke ${runId}`;
  const updatedName = `Nhóm smoke cập nhật ${runId}`;

  expect(department, "Seed department is required").toBeTruthy();
  expect(firstMember, "First team member is required").toBeTruthy();
  expect(secondMember, "Second team member is required").toBeTruthy();

  await openAppWithSession(page, admin);
  await page.getByTestId("nav-departments").click();
  await page.getByTestId("team-create-code").fill(code);
  await page.getByTestId("team-create-name").fill(name);
  await page.getByTestId("team-create-department").selectOption(department!.id);
  await page.getByTestId("team-create-members").getByLabel(firstMember!.fullName).check();

  const createResponse = page.waitForResponse((response) => response.url().endsWith("/teams") && response.request().method() === "POST");
  await page.getByTestId("team-create-save").click();
  const created = (await (await createResponse).json()) as TeamRecord;

  await expect(page.locator(`tr[data-testid="team-row-${created.id}"]`)).toBeVisible();
  await page.locator(`tr[data-testid="team-row-${created.id}"]`).click();
  await page.getByTestId("team-edit-name").fill(updatedName);
  await page.getByTestId("team-edit-members").getByLabel(secondMember!.fullName).check();

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  const updateResponse = page.waitForResponse((response) => response.url().includes(`/teams/${created.id}`) && response.request().method() === "PATCH");
  await page.getByTestId("team-edit-save").click();
  await updateResponse;

  const refreshed = await apiGet<TeamRecord[]>(request, admin, "/teams");
  const updated = refreshed.find((team) => team.id === created.id);
  expect(updated?.name).toBe(updatedName);
  expect(updated?.department?.id).toBe(department!.id);
  expect(updated?.members?.some((member) => member.user.id === firstMember!.id)).toBe(true);
  expect(updated?.members?.some((member) => member.user.id === secondMember!.id)).toBe(true);
});

test("admin quản lý danh mục và nhãn công việc trên UI", async ({ page, request }) => {
  const admin = await apiLogin(request, "admin");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  const categoryCode = `SMOKE_${suffix}`;
  const categoryName = `Danh mục ${suffix}`;
  const updatedCategoryName = `Danh mục ${suffix} cập nhật`;
  const tagName = `Nhãn ${suffix}`;
  const updatedTagName = `Nhãn ${suffix} cập nhật`;

  await openAppWithSession(page, admin);
  await page.getByTestId("nav-catalogs").click();

  await page.getByTestId("catalog-category-code").fill(categoryCode);
  await page.getByTestId("catalog-category-name").fill(categoryName);
  await page.getByTestId("catalog-category-description").fill("Danh mục tạo bởi smoke test.");
  const categoryCreateResponse = page.waitForResponse((response) => response.url().endsWith("/task-categories") && response.request().method() === "POST");
  await page.getByTestId("catalog-category-create-save").click();
  const category = (await (await categoryCreateResponse).json()) as Record<string, any>;
  const categoryRow = page.locator(`tr[data-testid="catalog-category-row-${category.id}"]`);
  await expect(categoryRow).toBeVisible();

  await categoryRow.getByTestId(`catalog-category-edit-${category.id}`).click();
  await categoryRow.getByTestId(`catalog-category-edit-name-${category.id}`).fill(updatedCategoryName);
  const categoryUpdateResponse = page.waitForResponse((response) => response.url().includes(`/task-categories/${category.id}`) && response.request().method() === "PATCH");
  await categoryRow.getByTestId(`catalog-category-save-${category.id}`).click();
  await categoryUpdateResponse;
  await expect(categoryRow).toContainText(updatedCategoryName);

  await page.getByTestId("catalog-tag-name").fill(tagName);
  await page.getByTestId("catalog-tag-color").fill("#16a34a");
  const tagCreateResponse = page.waitForResponse((response) => response.url().endsWith("/tags") && response.request().method() === "POST");
  await page.getByTestId("catalog-tag-create-save").click();
  const tag = (await (await tagCreateResponse).json()) as Record<string, any>;
  const tagRow = page.locator(`tr[data-testid="catalog-tag-row-${tag.id}"]`);
  await expect(tagRow).toBeVisible();

  await tagRow.getByTestId(`catalog-tag-edit-${tag.id}`).click();
  await tagRow.getByTestId(`catalog-tag-edit-name-${tag.id}`).fill(updatedTagName);
  await tagRow.getByTestId(`catalog-tag-edit-color-${tag.id}`).fill("#dc2626");
  const tagUpdateResponse = page.waitForResponse((response) => response.url().includes(`/tags/${tag.id}`) && response.request().method() === "PATCH");
  await tagRow.getByTestId(`catalog-tag-save-${tag.id}`).click();
  await tagUpdateResponse;
  await expect(tagRow).toContainText(updatedTagName);

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  const tagDeleteResponse = page.waitForResponse((response) => response.url().includes(`/tags/${tag.id}`) && response.request().method() === "DELETE");
  await tagRow.getByTestId(`catalog-tag-delete-${tag.id}`).click();
  await tagDeleteResponse;
  const tags = await apiGet<Record<string, any>[]>(request, admin, "/tags");
  expect(tags.some((item) => item.id === tag.id)).toBe(false);

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  const categoryDeleteResponse = page.waitForResponse((response) => response.url().includes(`/task-categories/${category.id}`) && response.request().method() === "DELETE");
  await categoryRow.getByTestId(`catalog-category-delete-${category.id}`).click();
  await categoryDeleteResponse;
  const categories = await apiGet<Record<string, any>[]>(request, admin, "/task-categories");
  expect(categories.some((item) => item.id === category.id)).toBe(false);

  const categoryLogs = await apiGet<Paginated<Record<string, any>>>(
    request,
    admin,
    "/activity-logs?action=task_category.delete&entityType=task_categories&pageSize=20"
  );
  expect(categoryLogs.data.some((log) => log.entityId === category.id)).toBe(true);
  const tagLogs = await apiGet<Paginated<Record<string, any>>>(request, admin, "/activity-logs?action=tag.delete&entityType=tags&pageSize=20");
  expect(tagLogs.data.some((log) => log.entityId === tag.id)).toBe(true);
});

test("admin reviews role permission preview on UI", async ({ page, request }) => {
  const admin = await apiLogin(request, "admin");

  await openAppWithSession(page, admin);
  await page.getByTestId("nav-roles").click();
  await expect(page.getByTestId("role-card-manager")).toBeVisible();
  await page.getByTestId("role-card-manager").click();
  await expect(page.getByTestId("role-permission-preview")).toBeVisible();
  await expect(page.getByTestId("role-permission-preview").locator("div")).toHaveCount(4);
});

test("audit log ghi metadata thay đổi cấu hình và ẩn giá trị nhạy cảm", async ({ request }) => {
  const admin = await apiLogin(request, "admin");
  const visibleKey = `smoke.audit.visible.${runId}`;
  const firstSetting = await apiPut<Record<string, any>>(request, admin, "/system-settings", {
    key: visibleKey,
    value: { enabled: false, runId },
    description: "Smoke audit initial"
  });
  await apiPut<Record<string, any>>(request, admin, "/system-settings", {
    key: visibleKey,
    value: { enabled: true, runId },
    description: "Smoke audit updated"
  });
  const logs = await apiGet<Paginated<Record<string, any>>>(
    request,
    admin,
    "/activity-logs?action=system_setting.upsert&entityType=system_settings&pageSize=20"
  );
  const visibleLog = logs.data.find((log) => log.entityId === firstSetting.id && log.metadata?.key === visibleKey && log.metadata?.operation === "update");
  expect(visibleLog?.metadata?.previousValue).toMatchObject({ enabled: false, runId });
  expect(visibleLog?.metadata?.nextValue).toMatchObject({ enabled: true, runId });

  const secretKey = `security.token.${runId}`;
  const secretValue = `secret-${runId}`;
  const secretSetting = await apiPut<Record<string, any>>(request, admin, "/system-settings", {
    key: secretKey,
    value: secretValue,
    description: "Smoke secret audit redaction"
  });
  const secretLogs = await apiGet<Paginated<Record<string, any>>>(
    request,
    admin,
    "/activity-logs?action=system_setting.upsert&entityType=system_settings&pageSize=20"
  );
  const secretLog = secretLogs.data.find((log) => log.entityId === secretSetting.id && log.metadata?.key === secretKey);
  expect(secretLog?.metadata?.nextValue).toBe("[REDACTED]");
  expect(JSON.stringify(secretLog?.metadata)).not.toContain(secretValue);
});

test("cấu hình mã tự động áp dụng cho task và hồ sơ quy trình", async ({ page, request }) => {
  const admin = await apiLogin(request, "admin");
  const manager = await apiLogin(request, "manager");
  const employee = await apiLogin(request, "employee");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const taskPrefix = `TS${suffix}`;
  const workflowPrefix = `WI${suffix}`;

  try {
    await openAppWithSession(page, admin);
    await page.getByTestId("nav-settings").click();
    await page.getByTestId("settings-task-prefix").fill(taskPrefix);
    await page.getByTestId("settings-task-padding").fill("5");
    await page.getByTestId("settings-workflow-prefix").fill(workflowPrefix);
    await page.getByTestId("settings-workflow-padding").fill("3");
    await page.getByTestId("settings-auto-code-save").click();
    await expect(page.getByTestId("settings-message")).toContainText("mã tự động");

    const task = await createSmokeTask(request, manager, "auto-code");
    expect(task.code).toMatch(new RegExp(`^${taskPrefix}-\\d{8}-\\d{5}$`));

    const instance = await createSmokeWorkflowInstance(request, employee, "auto-code");
    expect(instance.code).toMatch(new RegExp(`^${workflowPrefix}-\\d{8}-\\d{3}$`));
  } finally {
    await Promise.all([
      apiPut<Record<string, any>>(request, admin, "/system-settings", {
        key: "auto_code.task.prefix",
        value: "TASK",
        description: "Tiền tố mã công việc tự sinh."
      }),
      apiPut<Record<string, any>>(request, admin, "/system-settings", {
        key: "auto_code.task.padding",
        value: 4,
        description: "Số chữ số thứ tự trong mã công việc."
      }),
      apiPut<Record<string, any>>(request, admin, "/system-settings", {
        key: "auto_code.workflow_instance.prefix",
        value: "WF",
        description: "Tiền tố mã hồ sơ quy trình tự sinh."
      }),
      apiPut<Record<string, any>>(request, admin, "/system-settings", {
        key: "auto_code.workflow_instance.padding",
        value: 4,
        description: "Số chữ số thứ tự trong mã hồ sơ quy trình."
      })
    ]);
  }
});

test("cấu hình tệp upload áp dụng cho UI và API task attachment", async ({ page, request }) => {
  const admin = await apiLogin(request, "admin");
  const manager = await apiLogin(request, "manager");

  try {
    await openAppWithSession(page, admin);
    await page.getByTestId("nav-settings").click();
    await page.getByTestId("settings-file-max-mb").fill("1");
    await page.getByTestId("settings-file-mime-types").fill("application/pdf");
    await page.getByTestId("settings-file-config-save").click();
    await expect(page.getByTestId("settings-message")).toContainText("tệp upload");

    const uploadConfig = await apiGet<UploadConfigRecord>(request, admin, "/upload-config");
    expect(uploadConfig.maxMb).toBe(1);
    expect(uploadConfig.allowedMimeTypes).toEqual(["application/pdf"]);
    expect(uploadConfig.accept).toBe("application/pdf");

    await page.getByTestId("nav-newTask").click();
    await expect(page.getByTestId("task-create-attachment-input")).toHaveAttribute("accept", "application/pdf");

    const task = await createSmokeTask(request, manager, "file-config");
    const rejected = await request.post(`${apiUrl}/tasks/${task.id}/attachments`, {
      headers: authHeaders(manager),
      multipart: {
        file: {
          name: "blocked.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("blocked by smoke test")
        }
      }
    });
    expect(rejected.status()).toBe(400);

    const accepted = await request.post(`${apiUrl}/tasks/${task.id}/attachments`, {
      headers: authHeaders(manager),
      multipart: {
        file: {
          name: "accepted.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4\n% smoke\n")
        }
      }
    });
    expect(accepted.ok(), await accepted.text()).toBeTruthy();
  } finally {
    await Promise.all([
      apiPut<Record<string, any>>(request, admin, "/system-settings", {
        key: "file.upload.max_mb",
        value: 20,
        description: "Dung lượng tệp upload tối đa tính bằng MB, không vượt quá trần MAX_UPLOAD_MB."
      }),
      apiPut<Record<string, any>>(request, admin, "/system-settings", {
        key: "file.upload.allowed_mime_types",
        value: defaultUploadMimeTypes,
        description: "Danh sách MIME type được phép upload cho task và workflow."
      })
    ]);
  }
});

test("admin cấu hình thông báo, email, bảo mật và backup trên UI", async ({ page, request }) => {
  const admin = await apiLogin(request, "admin");
  const smtpHost = `smtp-${runId}.workflow.local`;
  const fromAddress = `notify-${runId.replace(/[^a-zA-Z0-9]/g, "")}@workflow.local`;

  try {
    await openAppWithSession(page, admin);
    await page.getByTestId("nav-settings").click();
    await page.getByTestId("settings-notification-push").check();
    await page.getByTestId("settings-notification-email").check();
    await page.getByTestId("settings-deadline-reminder-hours").fill("12");
    await page.getByTestId("settings-email-smtp-host").fill(smtpHost);
    await page.getByTestId("settings-email-smtp-port").fill("2525");
    await page.getByTestId("settings-email-from-address").fill(fromAddress);
    await page.getByTestId("settings-security-max-failed").fill("7");
    await page.getByTestId("settings-security-lock-minutes").fill("20");
    await page.getByTestId("settings-backup-schedule").fill("0 1 * * 1");
    await page.getByTestId("settings-backup-retention-days").fill("45");
    await page.getByTestId("settings-ops-config-save").click();
    await expect(page.getByTestId("settings-message")).toContainText("thông báo, email, bảo mật và backup");

    const settings = await apiGet<Array<Record<string, any>>>(request, admin, "/system-settings");
    const valueOf = (key: string) => settings.find((setting) => setting.key === key)?.value;
    expect(valueOf("notification.push.enabled")).toBe(true);
    expect(valueOf("notification.email.enabled")).toBe(true);
    expect(valueOf("notification.deadline_reminder_hours")).toBe(12);
    expect(valueOf("email.smtp.host")).toBe(smtpHost);
    expect(valueOf("email.smtp.port")).toBe(2525);
    expect(valueOf("email.from_address")).toBe(fromAddress);
    expect(valueOf("security.login.max_failed_attempts")).toBe(7);
    expect(valueOf("security.login.lock_minutes")).toBe(20);
    expect(valueOf("backup.database.schedule")).toBe("0 1 * * 1");
    expect(valueOf("backup.retention_days")).toBe(45);
  } finally {
    await Promise.all([
      apiPut<Record<string, any>>(request, admin, "/system-settings", {
        key: "notification.push.enabled",
        value: false,
        description: "Bật khả năng gửi push notification khi adapter được cấu hình."
      }),
      apiPut<Record<string, any>>(request, admin, "/system-settings", {
        key: "notification.email.enabled",
        value: false,
        description: "Bật khả năng gửi email notification khi SMTP được cấu hình."
      }),
      apiPut<Record<string, any>>(request, admin, "/system-settings", {
        key: "notification.deadline_reminder_hours",
        value: 24,
        description: "Số giờ nhắc trước hạn mặc định cho công việc/quy trình."
      }),
      apiPut<Record<string, any>>(request, admin, "/system-settings", {
        key: "email.smtp.host",
        value: "",
        description: "Máy chủ SMTP dùng cho email notification."
      }),
      apiPut<Record<string, any>>(request, admin, "/system-settings", {
        key: "email.smtp.port",
        value: 587,
        description: "Cổng SMTP."
      }),
      apiPut<Record<string, any>>(request, admin, "/system-settings", {
        key: "email.from_address",
        value: "no-reply@workflow.local",
        description: "Địa chỉ gửi email mặc định."
      }),
      apiPut<Record<string, any>>(request, admin, "/system-settings", {
        key: "security.login.max_failed_attempts",
        value: 5,
        description: "Số lần đăng nhập sai tối đa trước khi trì hoãn/khóa."
      }),
      apiPut<Record<string, any>>(request, admin, "/system-settings", {
        key: "security.login.lock_minutes",
        value: 15,
        description: "Số phút trì hoãn/khóa sau nhiều lần đăng nhập sai."
      }),
      apiPut<Record<string, any>>(request, admin, "/system-settings", {
        key: "backup.database.schedule",
        value: "0 2 * * *",
        description: "Lịch backup database dạng cron."
      }),
      apiPut<Record<string, any>>(request, admin, "/system-settings", {
        key: "backup.retention_days",
        value: 30,
        description: "Số ngày giữ bản backup."
      })
    ]);
  }
});

test("admin creates workflow template with dynamic builder", async ({ page, request }) => {
  const admin = await apiLogin(request, "admin");
  const employee = await apiLogin(request, "employee");
  const code = `SMOKE_${runId.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`;
  const name = `Smoke workflow ${runId}`;
  const defaultPurpose = `Noi dung mac dinh ${runId}`;

  await openAppWithSession(page, admin);
  await page.getByTestId("nav-workflowTemplates").click();
  await page.getByTestId("workflow-template-create").click();
  await page.getByTestId("workflow-template-code").fill(code);
  await page.getByTestId("workflow-template-name").fill(name);
  await page.getByTestId("workflow-field-default-0").fill(defaultPurpose);
  await page.getByTestId("workflow-field-min-length-0").fill("5");
  await page.getByTestId("workflow-field-max-length-0").fill("90");
  await page.getByTestId("workflow-field-min-value-1").fill("1000000");
  await page.getByTestId("workflow-field-max-value-1").fill("100000000");
  await page.getByTestId("workflow-field-add").click();
  await page.getByTestId("workflow-field-name-2").fill("Ghi chú kiểm thử");
  await page.getByTestId("workflow-field-code-2").fill("smoke_note");
  await page.getByTestId("workflow-field-type-2").selectOption("SELECT");
  await page.getByTestId("workflow-field-default-2").fill("Noi bo");
  await page.getByTestId("workflow-field-options-2").fill("Noi bo, Khach hang");
  await page.getByTestId("workflow-step-add").click();
  await page.getByTestId("workflow-step-name-1").fill("Xác nhận sau cùng");
  await page.getByTestId("workflow-step-code-1").fill("final_confirm");
  await page.getByTestId("workflow-step-approval-mode-1").selectOption("PARALLEL");
  await page.getByTestId("workflow-step-completion-rule-1").selectOption("MIN_COUNT");
  await page.getByTestId("workflow-step-min-count-1").fill("1");
  await page.getByTestId("workflow-condition-toggle-0").check();
  await page.getByTestId("workflow-condition-field-0").selectOption("amount");
  await page.getByTestId("workflow-condition-operator-0").selectOption("gt");
  await page.getByTestId("workflow-condition-value-0").fill("50000000");
  await expect(page.getByTestId("workflow-builder-preview")).toBeVisible();
  await expect(page.getByTestId("workflow-preview-form")).toContainText(defaultPurpose);
  await expect(page.getByTestId("workflow-preview-field-3")).toContainText("Noi bo, Khach hang");
  await expect(page.getByTestId("workflow-preview-steps")).toContainText("Xác nhận sau cùng");
  await expect(page.getByTestId("workflow-preview-step-1")).toContainText("50000000");
  await expect(page.getByTestId("workflow-preview-step-2")).toContainText("Đồng thời");
  await page.getByTestId("workflow-preview-mobile").click();
  await expect(page.getByTestId("workflow-builder-preview")).toHaveClass(/mobile/);
  await page.getByTestId("workflow-preview-desktop").click();
  await expect(page.getByTestId("workflow-builder-preview")).toHaveClass(/desktop/);

  const createResponse = page.waitForResponse((response) => response.url().endsWith("/workflow-templates") && response.request().method() === "POST");
  await page.getByTestId("workflow-template-save").click();
  const created = (await (await createResponse).json()) as WorkflowTemplateRecord;
  const condition = created.versions?.[0]?.transitions?.flatMap((transition) => transition.conditions ?? []).find((item) => item.fieldCode === "amount");
  const minCountStep = created.versions?.[0]?.steps?.find((step) => step.code === "final_confirm");
  const purposeField = created.versions?.[0]?.fields?.find((field) => field.code === "purpose");
  const amountField = created.versions?.[0]?.fields?.find((field) => field.code === "amount");
  const noteField = created.versions?.[0]?.fields?.find((field) => field.code === "smoke_note");
  expect(condition).toMatchObject({ fieldCode: "amount", operator: "gt", compareValue: 50000000 });
  expect(minCountStep).toMatchObject({ approvalMode: "PARALLEL", completionRule: "MIN_COUNT", minCount: 1 });
  expect(purposeField).toMatchObject({ defaultValue: defaultPurpose, validation: { minLength: 5, maxLength: 90 } });
  expect(amountField).toMatchObject({ validation: { min: 1000000, max: 100000000 } });
  expect(noteField).toMatchObject({ defaultValue: "Noi bo", validation: { options: ["Noi bo", "Khach hang"] } });
  const invalidOption = await request.post(`${apiUrl}/workflow-instances`, {
    headers: authHeaders(employee),
    data: {
      templateId: created.id,
      formData: { amount: 2_500_000, smoke_note: "Ngoai danh sach" },
      idempotencyKey: uniqueSlug("invalid-option")
    }
  });
  expect(invalidOption.status()).toBe(400);
  const validInstance = await apiPost<WorkflowInstanceRecord>(request, employee, "/workflow-instances", {
    templateId: created.id,
    formData: { amount: 2_500_000, smoke_note: "Khach hang" },
    idempotencyKey: uniqueSlug("valid-option")
  });
  expect(validInstance.status).toBe("IN_PROGRESS");
  await expect(page.locator(`tr[data-testid="workflow-template-row-${created.id}"]`)).toBeVisible();
  const templatesForCompare = await apiGet<WorkflowTemplateRecord[]>(request, admin, "/workflow-templates");
  const compareVersions = templatesForCompare.flatMap((template) => template.versions ?? []).filter((version) => version.id);
  expect(compareVersions.length).toBeGreaterThanOrEqual(2);
  await page.getByTestId("workflow-version-compare-left").selectOption(compareVersions[0]!.id);
  await page.getByTestId("workflow-version-compare-right").selectOption(compareVersions[1]!.id);
  const compareResponse = page.waitForResponse((response) => response.url().includes("/workflow-versions/") && response.url().includes("/compare/"));
  await page.getByTestId("workflow-version-compare-run").click();
  await compareResponse;
  await expect(page.getByTestId("workflow-version-compare-result")).toContainText("Trường");
});

test("employee creates workflow instance with dynamic form", async ({ page, request }) => {
  const employee = await apiLogin(request, "employee");
  const paymentTemplate = await getPaymentTemplate(request, employee);
  const purpose = `Smoke dynamic form ${runId}`;

  await openAppWithSession(page, employee);
  await page.getByTestId("nav-workflowInstances").click();
  await page.getByTestId("workflow-instance-create").click();
  await page.getByTestId("workflow-instance-template").selectOption(paymentTemplate.id);
  await expect(page.getByTestId("workflow-instance-field-purpose")).toBeVisible();
  await page.getByTestId("workflow-instance-field-purpose").fill(purpose);
  await page.getByTestId("workflow-instance-field-amount").fill("15000000");
  await page.getByTestId("workflow-instance-field-vendor").fill("Playwright Dynamic Vendor");

  const createResponse = page.waitForResponse((response) => response.url().endsWith("/workflow-instances") && response.request().method() === "POST");
  await page.getByTestId("workflow-instance-submit").click();
  const created = (await (await createResponse).json()) as WorkflowInstanceRecord;
  await expect(page.getByText(created.code)).toBeVisible();
  await expect(page.getByTestId("workflow-instance-values")).toContainText(purpose);
});

test("tạo task qua API rồi upload và download tệp trên UI", async ({ page, request }) => {
  const admin = await apiLogin(request, "admin");
  const manager = await apiLogin(request, "manager");
  const employee = await apiLogin(request, "employee");
  const task = await createSmokeTask(request, manager);
  const fileName = `smoke-${runId}.pdf`;
  const commentText = `Đính kèm kiểm thử ${runId}`;

  await openAppWithSession(page, manager);
  await openTaskFromNav(page, "nav-tasks", task);

  await page.getByTestId("task-comment-input").fill(commentText);
  await page.getByTestId("task-attachment-input").setInputFiles({
    name: fileName,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n")
  });
  await expect(page.getByText(fileName)).toBeVisible();
  await page.getByTestId("task-comment-submit").click();

  const attachmentButton = page
    .getByRole("button", { name: new RegExp(fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })
    .first();
  await expect(attachmentButton).toBeVisible();

  const detailWithComment = await apiGet<TaskDetailRecord>(request, manager, `/tasks/${task.id}`);
  const parentComment = detailWithComment.comments?.find((item) => item.content === commentText);
  if (!parentComment) throw new Error("Parent smoke comment was not saved");
  const attachment = detailWithComment.attachments?.find((item) => item.originalName === fileName);
  if (!attachment) throw new Error("Smoke attachment was not saved");
  const employeeNotifications = await apiGet<Paginated<Record<string, any>>>(request, employee, "/notifications?pageSize=20");
  expect(employeeNotifications.data.some((notification) => notification.type === "TASK_COMMENT_NEW" && notification.objectId === task.id)).toBe(true);
  const replyText = `Trả lời kiểm thử ${runId}`;
  await page.getByTestId(`task-comment-reply-${parentComment.id}`).click();
  await expect(page.getByTestId("task-comment-replying")).toContainText(manager.user.fullName);
  const replyResponse = page.waitForResponse(
    (response) => response.url().includes(`/tasks/${task.id}/comments`) && response.request().method() === "POST"
  );
  await page.getByTestId("task-comment-input").fill(replyText);
  await page.getByTestId("task-comment-submit").click();
  const replyResult = await replyResponse;
  expect(replyResult.ok(), await replyResult.text()).toBeTruthy();
  await expect(page.getByTestId(`task-comment-replies-${parentComment.id}`)).toContainText(replyText);
  const detailWithReply = await apiGet<TaskDetailRecord>(request, manager, `/tasks/${task.id}`);
  const replyComment = detailWithReply.comments?.find((item) => item.content === replyText);
  expect(replyComment?.parentCommentId).toBe(parentComment.id);

  const download = page.waitForEvent("download");
  await attachmentButton.click();
  const downloadedFile = await download;
  expect(downloadedFile.suggestedFilename()).toContain(fileName);
  const auditLogs = await apiGet<Paginated<Record<string, any>>>(
    request,
    admin,
    "/activity-logs?pageSize=20&action=task.attachment.download&entityType=task_attachments"
  );
  expect(auditLogs.data.some((log) => log.entityId === attachment.id && log.actor?.id === manager.user.id)).toBe(true);
});

test("tạo task kèm tệp đính kèm ngay trên form UI", async ({ page, request }) => {
  const manager = await apiLogin(request, "manager");
  const departments = await apiGet<DepartmentRecord[]>(request, manager, "/departments");
  const categories = await apiGet<TaskCategoryRecord[]>(request, manager, "/task-categories");
  const department = departments[0];
  const category = categories[0];
  const parentTask = await createSmokeTask(request, manager, "parent-link", {
    autoCalculateParentProgress: true,
    requiresReview: false
  });
  const relatedTask = await createSmokeTask(request, manager, "related-link");
  const title = `Smoke form attachment ${runId}`;
  const fileName = `create-form-${runId}.pdf`;

  expect(department, "Seed department is required").toBeTruthy();
  expect(category, "Seed task category is required").toBeTruthy();

  await openAppWithSession(page, manager);
  await page.getByTestId("nav-tasks").click();
  await page.getByTestId("task-create-open").click();
  await page.getByTestId("task-create-title").fill(title);
  await page.getByTestId("task-create-description").fill("Task created from UI with an attachment.");
  await page.getByTestId("task-create-priority").selectOption("HIGH");
  await page.getByTestId("task-create-assigner").selectOption(manager.user.id);
  await page.getByTestId("task-create-manager").selectOption(manager.user.id);
  await page.getByTestId("task-create-department").selectOption(department!.id);
  await page.getByTestId("task-create-start-date").fill(dateInput(0));
  await page.getByTestId("task-create-due-date").fill(dateInput(3));
  await page.getByTestId("task-create-category").selectOption(category!.id);
  await page.getByTestId("task-create-link-search").fill(parentTask.code);
  await expect(page.getByTestId("task-create-parent").locator(`option[value="${parentTask.id}"]`)).toHaveCount(1);
  await page.getByTestId("task-create-parent").selectOption(parentTask.id);
  await page.getByTestId("task-create-link-search").fill(relatedTask.code);
  await expect(page.getByTestId("task-create-related-tasks").getByLabel(`${relatedTask.code} - ${relatedTask.title}`)).toBeVisible();
  await page.getByTestId("task-create-related-tasks").getByLabel(`${relatedTask.code} - ${relatedTask.title}`).check();
  await page.getByTestId("task-create-attachment-input").setInputFiles({
    name: fileName,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n")
  });
  await expect(page.getByTestId("task-create-attachment-list")).toContainText(fileName);

  const createResponse = page.waitForResponse((response) => response.url().endsWith("/tasks") && response.request().method() === "POST");
  const uploadResponse = page.waitForResponse((response) => response.url().includes("/tasks/") && response.url().endsWith("/attachments") && response.request().method() === "POST");
  await page.getByTestId("task-create-save").click();
  const created = (await (await createResponse).json()) as TaskRecord;
  expect((await uploadResponse).ok()).toBe(true);
  await expect(page.getByText(created.code)).toBeVisible();

  const detail = await apiGet<TaskDetailRecord>(request, manager, `/tasks/${created.id}`);
  expect(detail.assigner?.id).toBe(manager.user.id);
  expect(detail.parentTask?.id).toBe(parentTask.id);
  expect(detail.dependenciesFrom?.some((dependency) => dependency.targetTask?.id === relatedTask.id)).toBe(true);
  expect(detail.attachments?.some((attachment) => attachment.originalName === fileName)).toBe(true);
  await apiPost<TaskRecord>(request, manager, `/tasks/${created.id}/progress`, {
    progress: 40,
    note: `Auto parent progress ${runId}`
  });
  const parentDetail = await apiGet<TaskDetailRecord>(request, manager, `/tasks/${parentTask.id}`);
  expect(parentDetail.progress).toBe(40);
  expect(parentDetail.subTaskProgress).toBe(40);
  await expect(page.getByTestId("task-relations")).toContainText(parentTask.code);
  await expect(page.getByTestId("task-relations")).toContainText(relatedTask.code);
  const attachmentButton = page
    .getByRole("button", { name: new RegExp(fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })
    .first();
  await expect(attachmentButton).toBeVisible();
});

test("lịch công việc hiển thị ngày bắt đầu và hạn hoàn thành", async ({ page, request }) => {
  const manager = await apiLogin(request, "manager");
  const task = await createSmokeTask(request, manager, "calendar", {
    startDate: `${dateInput(-29)}T00:00:00.000Z`,
    dueDate: `${dateInput(-28)}T00:00:00.000Z`
  });

  await openAppWithSession(page, manager);
  await page.getByTestId("nav-calendar").click();
  await expect(page.getByTestId("task-calendar-board")).toBeVisible();
  await expect(page.getByTestId(`task-calendar-start-${task.id}`)).toContainText("Bắt đầu");
  await expect(page.getByTestId(`task-calendar-start-${task.id}`)).toContainText(task.title);
  await expect(page.getByTestId(`task-calendar-due-${task.id}`)).toContainText("Hạn");
  await page.getByTestId(`task-calendar-due-${task.id}`).click();
  await expect(page.getByRole("heading", { name: task.title })).toBeVisible();
});

test("kanban xác nhận trước khi chuyển trạng thái quan trọng", async ({ page, request }) => {
  const manager = await apiLogin(request, "manager");
  const task = await createSmokeTask(request, manager, "kanban", {
    startDate: `${dateInput(-29)}T00:00:00.000Z`,
    dueDate: `${dateInput(-28)}T00:00:00.000Z`
  });

  await openAppWithSession(page, manager);
  await page.getByTestId("nav-kanban").click();
  await expect(page.getByTestId(`kanban-card-${task.id}`)).toBeVisible();
  const dataTransfer = await page.evaluateHandle((taskId) => {
    const transfer = new DataTransfer();
    transfer.setData("taskId", taskId);
    return transfer;
  }, task.id);
  await page.getByTestId("kanban-column-DONE").dispatchEvent("drop", { dataTransfer });
  await dataTransfer.dispose();
  await expect(page.getByTestId("kanban-confirm-panel")).toContainText(task.title);
  const updateResponse = page.waitForResponse(
    (response) => response.url().includes(`/tasks/${task.id}`) && response.request().method() === "PATCH"
  );
  await page.getByTestId("kanban-confirm-submit").click();
  const updateResult = await updateResponse;
  expect(updateResult.ok(), await updateResult.text()).toBeTruthy();
  await expect(page.getByTestId("kanban-message")).toContainText("Hoàn thành");
  const detail = await apiGet<TaskDetailRecord>(request, manager, `/tasks/${task.id}`);
  expect(detail.status).toBe("DONE");
});

test("lọc công việc phía server trên UI", async ({ page, request }) => {
  const manager = await apiLogin(request, "manager");
  const users = await apiGet<Paginated<UserRecord>>(request, manager, "/users?pageSize=100");
  const departments = await apiGet<DepartmentRecord[]>(request, manager, "/departments");
  const categories = await apiGet<TaskCategoryRecord[]>(request, manager, "/task-categories");
  const tags = await apiGet<TagRecord[]>(request, manager, "/tags");
  const assignee = users.data.find((user) => user.email === accounts.employee.email) ?? users.data[0];
  const department = assignee?.department ?? departments[0];
  const category = categories[0];
  const tag = tags[0];

  expect(assignee, "Seed employee is required").toBeTruthy();
  expect(department, "Seed department is required").toBeTruthy();
  expect(category, "Seed task category is required").toBeTruthy();
  expect(tag, "Seed tag is required").toBeTruthy();

  const task = await createSmokeTask(request, manager, "filters", {
    assigneeIds: [assignee!.id],
    managerId: manager.user.id,
    departmentId: department!.id,
    priority: "URGENT",
    categoryId: category!.id,
    tagIds: [tag!.id],
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString()
  });

  await openAppWithSession(page, manager);
  await page.getByTestId("nav-tasks").click();
  await page.getByTestId("task-filter-toggle").click();
  await expect(page.getByTestId("task-filter-panel")).toBeVisible();
  await expect(page.getByTestId("task-filter-assignee").locator(`option[value="${assignee!.id}"]`)).toHaveCount(1);
  await expect(page.getByTestId("task-filter-category").locator(`option[value="${category!.id}"]`)).toHaveCount(1);
  await expect(page.getByTestId("task-filter-tag").locator(`option[value="${tag!.id}"]`)).toHaveCount(1);

  await page.getByTestId("task-search-input").fill("Smoke filters");
  await page.getByTestId("task-filter-code").fill(task.code);
  await page.getByTestId("task-filter-creator").selectOption(manager.user.id);
  await page.getByTestId("task-filter-assignee").selectOption(assignee!.id);
  await page.getByTestId("task-filter-manager").selectOption(manager.user.id);
  await page.getByTestId("task-filter-department").selectOption(department!.id);
  await page.getByTestId("task-filter-priority").selectOption("URGENT");
  await page.getByTestId("task-filter-category").selectOption(category!.id);
  await page.getByTestId("task-filter-from").fill(dateInput(-2));
  await page.getByTestId("task-filter-to").fill(dateInput(8));
  const filteredResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname.endsWith("/tasks") &&
      url.searchParams.get("code") === task.code &&
      url.searchParams.get("priority") === "URGENT" &&
      url.searchParams.get("tagId") === tag!.id
    );
  });
  await page.getByTestId("task-filter-tag").selectOption(tag!.id);
  await filteredResponse;

  await expect(page.locator(`tr[data-testid="task-row-${task.id}"]`)).toBeVisible();
  await page.getByTestId("task-filter-reset").click();
  await expect(page.getByTestId("task-search-input")).toHaveValue("");
  await expect(page.getByTestId("task-filter-code")).toHaveValue("");
});

test("phân trang danh sách công việc trên UI", async ({ page, request }) => {
  const manager = await apiLogin(request, "manager");
  const label = `pagination-${runId}`;
  const firstTask = await createSmokeTask(request, manager, label, {
    startDate: `${dateInput(-29)}T00:00:00.000Z`,
    dueDate: `${dateInput(-27)}T00:00:00.000Z`,
    requiresReview: false
  });
  for (let index = 0; index < 10; index += 1) {
    await createSmokeTask(request, manager, label, {
      startDate: `${dateInput(-29)}T00:00:00.000Z`,
      dueDate: `${dateInput(-28)}T00:00:00.000Z`,
      requiresReview: false
    });
  }

  await openAppWithSession(page, manager);
  await page.getByTestId("nav-tasks").click();
  await page.getByTestId("task-search-input").fill(`Smoke ${label}`);
  await expect(page.getByTestId("task-pagination-summary")).toContainText("Trang 1/2");
  await expect(page.getByTestId("task-pagination-next")).toBeEnabled();
  await page.getByTestId("task-pagination-next").click();
  await expect(page.getByTestId("task-pagination-summary")).toContainText("Trang 2/2");
  await expect(page.locator(`tr[data-testid="task-row-${firstTask.id}"]`)).toBeVisible();
  await page.getByTestId("task-pagination-prev").click();
  await expect(page.getByTestId("task-pagination-summary")).toContainText("Trang 1/2");
});

test("sắp xếp danh sách công việc phía server trên UI", async ({ page, request }) => {
  const manager = await apiLogin(request, "manager");
  const label = `sort-${runId}`;
  const earlyTask = await createSmokeTask(request, manager, label, {
    startDate: `${dateInput(-29)}T00:00:00.000Z`,
    dueDate: `${dateInput(-28)}T00:00:00.000Z`,
    requiresReview: false
  });
  const lateTask = await createSmokeTask(request, manager, label, {
    startDate: `${dateInput(-29)}T00:00:00.000Z`,
    dueDate: `${dateInput(-27)}T00:00:00.000Z`,
    requiresReview: false
  });

  await openAppWithSession(page, manager);
  await page.getByTestId("nav-tasks").click();
  await page.getByTestId("task-search-input").fill(`Smoke ${label}`);
  await page.getByTestId("task-sort-by").selectOption("dueDate");
  const descResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith("/tasks") && url.searchParams.get("sortBy") === "dueDate" && url.searchParams.get("sortOrder") === "desc";
  });
  await page.getByTestId("task-sort-order").selectOption("desc");
  await descResponse;
  await expect(page.locator("tbody tr").first()).toHaveAttribute("data-testid", `task-row-${lateTask.id}`);

  const ascResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith("/tasks") && url.searchParams.get("sortBy") === "dueDate" && url.searchParams.get("sortOrder") === "asc";
  });
  await page.getByTestId("task-sort-order").selectOption("asc");
  await ascResponse;
  await expect(page.locator("tbody tr").first()).toHaveAttribute("data-testid", `task-row-${earlyTask.id}`);
});

test("danh sách công việc có thao tác nhanh bắt đầu", async ({ page, request }) => {
  const manager = await apiLogin(request, "manager");
  const task = await createSmokeTask(request, manager, "list-action", { status: "TODO" });

  await openAppWithSession(page, manager);
  await page.getByTestId("nav-tasks").click();
  await page.getByTestId("task-search-input").fill(task.title);
  const row = page.locator(`tr[data-testid="task-row-${task.id}"]`);
  await expect(row).toBeVisible();

  const updateResponse = page.waitForResponse(
    (response) => response.url().includes(`/tasks/${task.id}`) && response.request().method() === "PATCH"
  );
  await row.getByTestId(`task-row-start-${task.id}`).click();
  const result = await updateResponse;
  expect(result.ok(), await result.text()).toBeTruthy();

  await expect(page.getByTestId("task-list-action-message")).toContainText(task.code);
  await expect(row).toContainText("Đang thực hiện");
  const detail = await apiGet<TaskDetailRecord>(request, manager, `/tasks/${task.id}`);
  expect(detail.status).toBe("IN_PROGRESS");
});

test("nhân viên cập nhật tiến độ task lên chờ đánh giá trên UI", async ({ page, request }) => {
  const manager = await apiLogin(request, "manager");
  const employee = await apiLogin(request, "employee");
  const task = await createSmokeTask(request, manager, "progress");

  await openAppWithSession(page, employee);
  await openTaskFromNav(page, "nav-myTasks", task);

  await page.getByTestId("task-progress-range").evaluate((element, value) => {
    const input = element as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, 100);
  await page.getByTestId("task-progress-note").fill(`Hoàn tất smoke ${runId}`);
  await page.getByTestId("task-progress-submit").click();

  await expect(page.getByTestId("task-detail-progress")).toHaveText("100%");
  await expect(page.getByTestId("task-detail-status")).toContainText("Chờ đánh giá");
});

test("công việc của tôi có đủ tab và lọc theo dữ liệu liên quan", async ({ page, request }) => {
  const manager = await apiLogin(request, "manager");
  const employee = await apiLogin(request, "employee");
  const reviewTask = await createSmokeTask(request, manager, "my-tabs", {
    followerIds: [manager.user.id]
  });
  const overdueTask = await createSmokeTask(request, manager, "my-tabs-overdue", {
    followerIds: [manager.user.id],
    startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  });

  await apiPost<Record<string, any>>(request, employee, `/tasks/${reviewTask.id}/progress`, {
    progress: 100,
    note: `Sẵn sàng duyệt từ tab ${runId}`
  });

  await openAppWithSession(page, manager);
  await page.getByTestId("nav-myTasks").click();
  await page.getByTestId("task-search-input").fill(reviewTask.title);

  for (const tab of ["assignee", "assigner", "manager", "follower", "review", "overdue", "done"]) {
    await expect(page.getByTestId(`my-task-tab-${tab}`)).toBeVisible();
  }

  await page.getByTestId("my-task-tab-assigner").click();
  await expect(page.locator(`tr[data-testid="task-row-${reviewTask.id}"]`)).toBeVisible();

  await page.getByTestId("my-task-tab-manager").click();
  await expect(page.locator(`tr[data-testid="task-row-${reviewTask.id}"]`)).toBeVisible();

  await page.getByTestId("my-task-tab-follower").click();
  await expect(page.locator(`tr[data-testid="task-row-${reviewTask.id}"]`)).toBeVisible();

  await page.getByTestId("my-task-tab-review").click();
  await expect(page.locator(`tr[data-testid="task-row-${reviewTask.id}"]`)).toBeVisible();

  await page.getByTestId("my-task-tab-overdue").click();
  await page.getByTestId("task-search-input").fill(overdueTask.title);
  await expect(page.locator(`tr[data-testid="task-row-${overdueTask.id}"]`)).toBeVisible();

  await apiPost<Record<string, any>>(request, manager, `/tasks/${reviewTask.id}/evaluations`, {
    accepted: true,
    rating: 5,
    comment: `Hoàn thành từ tab ${runId}`
  });
  await page.getByTestId("my-task-tab-done").click();
  await page.getByTestId("task-search-input").fill(reviewTask.title);
  await expect(page.locator(`tr[data-testid="task-row-${reviewTask.id}"]`)).toBeVisible();
});

test("quản lý đánh giá hoàn thành task bằng panel UI", async ({ page, request }) => {
  const manager = await apiLogin(request, "manager");
  const employee = await apiLogin(request, "employee");
  const task = await createSmokeTask(request, manager, "evaluation");
  const fileName = `evaluation-${runId}.pdf`;

  await apiPost<Record<string, any>>(request, employee, `/tasks/${task.id}/progress`, {
    progress: 100,
    note: `Sẵn sàng đánh giá ${runId}`
  });

  await openAppWithSession(page, manager);
  await openTaskFromNav(page, "nav-tasks", task);
  await expect(page.getByTestId("task-detail-status")).toContainText("Chờ đánh giá");
  await page.getByTestId("task-evaluate-accept").click();
  await expect(page.getByTestId("task-evaluation-panel")).toBeVisible();
  await page.getByTestId("task-evaluation-rating-4").click();
  await page.getByTestId("task-evaluation-comment").fill(`Đạt yêu cầu smoke ${runId}`);
  await page.getByTestId("task-evaluation-attachment-input").setInputFiles({
    name: fileName,
    mimeType: "application/pdf",
    buffer: Buffer.from(`evaluation evidence ${runId}`)
  });
  await expect(page.getByTestId("task-evaluation-attachment-list")).toContainText(fileName);
  const uploadResponse = page.waitForResponse(
    (response) => response.url().includes(`/tasks/${task.id}/attachments`) && response.request().method() === "POST"
  );
  const evaluationResponse = page.waitForResponse(
    (response) => response.url().includes(`/tasks/${task.id}/evaluations`) && response.request().method() === "POST"
  );
  await page.getByTestId("task-evaluation-submit").click();
  const [uploadResult, evaluationResult] = await Promise.all([uploadResponse, evaluationResponse]);
  expect(uploadResult.ok(), await uploadResult.text()).toBeTruthy();
  expect(evaluationResult.ok(), await evaluationResult.text()).toBeTruthy();
  const detail = await apiGet<TaskDetailRecord>(request, manager, `/tasks/${task.id}`);
  const evaluationAttachmentIds = new Set(detail.evaluations?.[0]?.attachmentIds ?? []);
  expect(evaluationAttachmentIds.size).toBeGreaterThan(0);
  expect(detail.attachments?.some((attachment) => attachment.originalName === fileName && evaluationAttachmentIds.has(attachment.id))).toBe(true);
  await expect(page.getByTestId("task-detail-status")).toContainText("Hoàn thành");
});

test("yêu cầu làm lại reset tiến độ theo cấu hình", async ({ page, request }) => {
  const admin = await apiLogin(request, "admin");
  const manager = await apiLogin(request, "manager");
  const employee = await apiLogin(request, "employee");

  try {
    await openAppWithSession(page, admin);
    await page.getByTestId("nav-settings").click();
    await page.getByTestId("settings-task-redo-reset").check();
    await page.getByTestId("settings-task-config-save").click();
    await expect(page.getByTestId("settings-message")).toContainText("công việc");

    const task = await createSmokeTask(request, manager, "redo-reset");
    await apiPost<Record<string, any>>(request, employee, `/tasks/${task.id}/progress`, {
      progress: 100,
      note: `Sẵn sàng làm lại ${runId}`
    });

    await openAppWithSession(page, manager);
    await openTaskFromNav(page, "nav-tasks", task);
    await expect(page.getByTestId("task-detail-status")).toContainText("Chờ đánh giá");
    await page.getByTestId("task-evaluate-redo").click();
    await expect(page.getByTestId("task-evaluation-panel")).toBeVisible();
    await page.getByTestId("task-evaluation-comment").fill(`Cần làm lại smoke ${runId}`);
    const redoResponse = page.waitForResponse(
      (response) => response.url().includes(`/tasks/${task.id}/evaluations`) && response.request().method() === "POST"
    );
    await page.getByTestId("task-evaluation-submit").click();
    const redoResult = await redoResponse;
    expect(redoResult.ok(), await redoResult.text()).toBeTruthy();
    await expect(page.getByTestId("task-detail-status")).toContainText("Đang thực hiện");
    await expect(page.getByTestId("task-detail-progress")).toContainText("0%");
    const detail = await apiGet<TaskDetailRecord>(request, manager, `/tasks/${task.id}`);
    expect(detail.progress).toBe(0);
  } finally {
    await apiPut<Record<string, any>>(request, admin, "/system-settings", {
      key: "task.redo.reset_progress",
      value: false,
      description: "Có đặt lại tiến độ khi yêu cầu thực hiện lại hay không."
    });
  }
});

test("duyệt hồ sơ PAYMENT tuần tự trên UI", async ({ page, request }) => {
  const employee = await apiLogin(request, "employee");
  const manager = await apiLogin(request, "manager");
  const instance = await createSmokeWorkflowInstance(request, employee, "approve");
  const fileName = `workflow-approve-${runId}.pdf`;

  await openWorkflowApproval(page, manager, instance);
  await expect(page.getByTestId("workflow-progress-map")).toBeVisible();
  await expect(page.getByTestId("workflow-progress-summary")).toContainText("Bước hiện tại");
  await expect(page.getByTestId("workflow-progress-current-users")).toContainText(manager.user.fullName);
  await expect(page.locator('[data-testid^="workflow-progress-step-"]').first()).toBeVisible();
  await runWorkflowAction(page, "workflow-action-approve", `Duyệt smoke ${runId}`, undefined, {
    name: fileName,
    mimeType: "application/pdf",
    buffer: Buffer.from(`workflow approval attachment ${runId}`)
  });
  await expect(page.getByTestId("workflow-instance-status")).toContainText(/Đã duyệt|Hoàn thành/);
  await expect(page.locator('[data-testid^="workflow-progress-step-"].done').first()).toBeVisible();
  await expect(page.getByTestId("workflow-approval-history")).toContainText(fileName);
  const detail = await apiGet<WorkflowInstanceDetailRecord>(request, manager, `/workflow-instances/${instance.id}`);
  expect((detail.workflowVersion?.steps ?? []).length).toBeGreaterThan(0);
  expect((detail.workflowVersion?.transitions ?? []).length).toBeGreaterThan(0);
  expect(detail.approvals?.some((approval) => approval.attachments?.some((attachment) => attachment.originalName === fileName))).toBe(true);
  const notifications = await apiGet<Paginated<Record<string, any>>>(request, employee, "/notifications?pageSize=20");
  expect(notifications.data.some((notification) => notification.type === "WORKFLOW_APPROVED" && notification.objectId === instance.id)).toBe(true);
});

test("từ chối hồ sơ PAYMENT trên UI", async ({ page, request }) => {
  const employee = await apiLogin(request, "employee");
  const manager = await apiLogin(request, "manager");
  const instance = await createSmokeWorkflowInstance(request, employee, "reject");

  await openWorkflowApproval(page, manager, instance);
  await runWorkflowAction(page, "workflow-action-reject", `Từ chối smoke ${runId}`);
  await expect(page.getByTestId("workflow-instance-status")).toContainText("Bị từ chối");
});

test("yêu cầu bổ sung hồ sơ PAYMENT trên UI", async ({ page, request }) => {
  const employee = await apiLogin(request, "employee");
  const manager = await apiLogin(request, "manager");
  const instance = await createSmokeWorkflowInstance(request, employee, "request-info");

  await openWorkflowApproval(page, manager, instance);
  await runWorkflowAction(page, "workflow-action-request-info", `Bổ sung smoke ${runId}`);
  await expect(page.getByTestId("workflow-instance-status")).toContainText("Chờ bổ sung");
});

test("trả bước hồ sơ PAYMENT về người xử lý trước", async ({ page, request }) => {
  const employee = await apiLogin(request, "employee");
  const manager = await apiLogin(request, "manager");
  const admin = await apiLogin(request, "admin");
  const instance = await createSmokeWorkflowInstance(request, employee, "return", { amount: 72_000_000 });

  await openWorkflowApproval(page, manager, instance);
  await runWorkflowAction(page, "workflow-action-approve", `Manager duyệt để chuyển giám đốc ${runId}`);

  await openWorkflowApproval(page, admin, instance);
  await runWorkflowAction(page, "workflow-action-return", `Trả bước smoke ${runId}`);
  await expect(page.getByTestId("workflow-instance-status")).toContainText("Đang thực hiện");

  const returned = await apiGet<WorkflowInstanceDetailRecord>(request, manager, `/workflow-instances/${instance.id}`);
  expect(returned.status).toBe("IN_PROGRESS");
  expect(returned.approvals?.some((approval) => approval.status === "PENDING" && approval.approver?.id === manager.user.id)).toBe(true);
  expect(returned.approvals?.some((approval) => approval.action === "RETURN" && approval.approver?.id === admin.user.id)).toBe(true);
});

test("chuyển xử lý hồ sơ PAYMENT sang người khác", async ({ page, request }) => {
  const employee = await apiLogin(request, "employee");
  const manager = await apiLogin(request, "manager");
  const admin = await apiLogin(request, "admin");
  const instance = await createSmokeWorkflowInstance(request, employee, "transfer");

  await openWorkflowApproval(page, manager, instance);
  await runWorkflowAction(page, "workflow-action-transfer", `Chuyển xử lý smoke ${runId}`, admin.user.id);

  const transferred = await apiGet<WorkflowInstanceDetailRecord>(request, admin, `/workflow-instances/${instance.id}`);
  expect(transferred.approvals?.some((approval) => approval.status === "PENDING" && approval.approver?.id === admin.user.id)).toBe(true);

  await openWorkflowApproval(page, admin, instance);
  await runWorkflowAction(page, "workflow-action-approve", `Admin duyệt sau chuyển ${runId}`);
  await expect(page.getByTestId("workflow-instance-status")).toContainText(/Đã duyệt|Hoàn thành/);
});

test("idempotency key không ghi nhận duyệt trùng", async ({ request }) => {
  const employee = await apiLogin(request, "employee");
  const manager = await apiLogin(request, "manager");
  const instance = await createSmokeWorkflowInstance(request, employee, "idempotency");
  const idempotencyKey = `smoke-approve-action-${uniqueSlug("idempotency")}`;

  const first = await apiPost<WorkflowInstanceRecord>(request, manager, `/workflow-instances/${instance.id}/actions`, {
    action: "APPROVE",
    comment: `Duyệt lần 1 ${runId}`,
    idempotencyKey
  });
  const second = await apiPost<WorkflowInstanceRecord>(request, manager, `/workflow-instances/${instance.id}/actions`, {
    action: "APPROVE",
    comment: `Duyệt lần 2 ${runId}`,
    idempotencyKey
  });
  const detail = await apiGet<WorkflowInstanceDetailRecord>(request, manager, `/workflow-instances/${instance.id}`);

  expect(second.id).toBe(first.id);
  expect(second.status).toBe(first.status);
  expect(detail.approvals?.filter((approval) => approval.action === "APPROVE")).toHaveLength(1);
});

test("người dùng đổi mật khẩu và phiên cũ bị thu hồi", async ({ page, request }) => {
  const admin = await apiLogin(request, "admin");
  const slug = uniqueSlug("password").replace(/[^a-z0-9]/gi, "").slice(0, 18);
  const email = `password-${slug}@workflow.local`;
  const oldPassword = "OldPass@123456";
  const newPassword = `NewPass@${String(Date.now()).slice(-6)}`;

  await apiPost<Record<string, any>>(request, admin, "/users", {
    employeeCode: `PW${String(Date.now()).slice(-8)}`,
    fullName: `User đổi mật khẩu ${runId}`,
    email,
    password: oldPassword,
    roleIds: [],
    teamIds: []
  });

  const tempSession = await parseApi<ApiSession>(await rawLoginWithRetry(request, email, oldPassword, "Password smoke"));
  await openAppWithSession(page, tempSession);
  await page.getByTestId("account-profile-open").click();
  await page.getByTestId("profile-current-password").fill(oldPassword);
  await page.getByTestId("profile-new-password").fill(newPassword);
  await page.getByTestId("profile-confirm-password").fill(newPassword);
  await page.getByTestId("profile-password-save").click();
  await expect(page.getByTestId("login-submit")).toBeVisible();

  const revokedRefresh = await request.post(`${apiUrl}/auth/refresh`, {
    data: { refreshToken: tempSession.refreshToken }
  });
  expect(revokedRefresh.status()).toBe(401);

  const oldLogin = await rawLoginWithRetry(request, email, oldPassword, "Old password check");
  expect(oldLogin.status()).toBe(401);

  const newLogin = await parseApi<ApiSession>(await rawLoginWithRetry(request, email, newPassword, "New password check"));
  expect(newLogin.accessToken).toBeTruthy();
});
