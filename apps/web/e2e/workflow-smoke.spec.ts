import { expect, test, type APIRequestContext, type APIResponse, type Page } from "@playwright/test";

const apiUrl = (process.env.E2E_API_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "");
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const accounts = {
  admin: { email: "admin@workflow.local", password: "Admin@123456" },
  manager: { email: "manager@workflow.local", password: "Manager@123456" },
  employee: { email: "lan@workflow.local", password: "Demo@123456" }
} as const;

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
  email: string;
  fullName: string;
  department?: { id: string; name: string } | null;
}

interface DepartmentRecord {
  id: string;
  code: string;
  name: string;
}

interface TaskRecord {
  id: string;
  code: string;
  title: string;
}

interface WorkflowTemplateRecord {
  id: string;
  code: string;
  name: string;
}

interface WorkflowInstanceRecord {
  id: string;
  code: string;
  status: string;
}

interface WorkflowInstanceDetailRecord extends WorkflowInstanceRecord {
  approvals?: Array<{
    id: string;
    action?: string | null;
    status: string;
  }>;
}

const sessionCache = new Map<AccountKey, ApiSession>();

test.describe.configure({ mode: "serial" });

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uniqueSlug(label: string) {
  return `${label}-${runId}-${Math.random().toString(36).slice(2, 8)}`;
}

async function parseApi<T>(response: APIResponse): Promise<T> {
  const text = await response.text();
  if (!response.ok()) {
    throw new Error(`API ${response.status()} ${response.url()}: ${text}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
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
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await request.post(`${apiUrl}/auth/login`, {
      data: {
        email: credentials.email,
        password: credentials.password,
        deviceName: "Playwright smoke"
      }
    });
    if (response.status() === 429 && attempt < 2) {
      await wait(25_000);
      continue;
    }
    const session = await parseApi<ApiSession>(response);
    sessionCache.set(account, session);
    return session;
  }

  throw new Error(`Unable to login ${account}`);
}

async function apiGet<T>(request: APIRequestContext, session: ApiSession, path: string): Promise<T> {
  return parseApi<T>(
    await request.get(`${apiUrl}${path}`, {
      headers: authHeaders(session)
    })
  );
}

async function apiPost<T>(request: APIRequestContext, session: ApiSession, path: string, data: unknown): Promise<T> {
  return parseApi<T>(
    await request.post(`${apiUrl}${path}`, {
      headers: authHeaders(session),
      data
    })
  );
}

async function openAppWithSession(page: Page, session: ApiSession) {
  await page.addInitScript((storedSession) => {
    window.sessionStorage.setItem(
      "workflow.session",
      JSON.stringify({
        accessToken: storedSession.accessToken,
        refreshToken: storedSession.refreshToken
      })
    );
  }, session);
  await page.goto("/");
  await expect(page.getByTestId("nav-dashboard")).toBeVisible();
}

async function createSmokeTask(request: APIRequestContext, manager: ApiSession, label = "upload") {
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
    requiresReview: true
  });
}

async function createSmokeWorkflowInstance(request: APIRequestContext, employee: ApiSession, label = "approval") {
  const templates = await apiGet<WorkflowTemplateRecord[]>(request, employee, "/workflow-templates");
  const paymentTemplate = templates.find((template) => template.code === "PAYMENT") ?? templates[0];
  const slug = uniqueSlug(label);
  expect(paymentTemplate, "Seed payment workflow template is required").toBeTruthy();

  return apiPost<WorkflowInstanceRecord>(request, employee, "/workflow-instances", {
    templateId: paymentTemplate!.id,
    formData: {
      purpose: `Smoke ${label} ${slug}`,
      amount: 12_000_000,
      vendor: "Playwright Vendor"
    },
    idempotencyKey: `smoke-instance-${slug}`
  });
}

async function openWorkflowApproval(page: Page, manager: ApiSession, instance: WorkflowInstanceRecord) {
  await openAppWithSession(page, manager);
  await page.getByTestId("nav-approvals").click();
  const row = page.locator(`tr[data-testid="workflow-instance-row-${instance.id}"]`);
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByText(instance.code)).toBeVisible();
}

async function runPromptedAction(page: Page, testId: string, comment: string) {
  page.on("dialog", async (dialog) => {
    if (dialog.type() === "prompt") {
      await dialog.accept(comment);
      return;
    }
    await dialog.accept();
  });
  await page.getByTestId(testId).click();
}

test("đăng nhập web bằng tài khoản quản trị", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("login-email").fill(accounts.admin.email);
  await page.getByTestId("login-password").fill(accounts.admin.password);
  await page.getByTestId("login-submit").click();

  await expect(page.getByTestId("nav-dashboard")).toBeVisible();
  await expect(page.getByTestId("nav-tasks")).toBeVisible();
});

test("tạo task qua API rồi upload và download tệp trên UI", async ({ page, request }) => {
  const manager = await apiLogin(request, "manager");
  const task = await createSmokeTask(request, manager);
  const fileName = `smoke-${runId}.pdf`;

  await openAppWithSession(page, manager);
  await page.getByTestId("nav-tasks").click();
  await expect(page.locator(`tr[data-testid="task-row-${task.id}"]`)).toBeVisible();
  await page.locator(`tr[data-testid="task-row-${task.id}"]`).click();
  await expect(page.getByText(task.title)).toBeVisible();

  await page.getByTestId("task-comment-input").fill(`Đính kèm kiểm thử ${runId}`);
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
  const download = page.waitForEvent("download");
  await attachmentButton.click();
  const downloadedFile = await download;
  expect(downloadedFile.suggestedFilename()).toContain(fileName);
});

test("nhân viên cập nhật tiến độ task lên chờ đánh giá trên UI", async ({ page, request }) => {
  const manager = await apiLogin(request, "manager");
  const employee = await apiLogin(request, "employee");
  const task = await createSmokeTask(request, manager, "progress");

  await openAppWithSession(page, employee);
  await page.getByTestId("nav-myTasks").click();
  const row = page.locator(`tr[data-testid="task-row-${task.id}"]`);
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByText(task.title)).toBeVisible();

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

test("duyệt hồ sơ PAYMENT tuần tự trên UI", async ({ page, request }) => {
  const employee = await apiLogin(request, "employee");
  const manager = await apiLogin(request, "manager");
  const instance = await createSmokeWorkflowInstance(request, employee, "approve");

  await openWorkflowApproval(page, manager, instance);
  await runPromptedAction(page, "workflow-action-approve", `Duyệt smoke ${runId}`);
  await expect(page.getByTestId("workflow-instance-status")).toContainText(/Đã duyệt|Hoàn thành/);
});

test("từ chối hồ sơ PAYMENT trên UI", async ({ page, request }) => {
  const employee = await apiLogin(request, "employee");
  const manager = await apiLogin(request, "manager");
  const instance = await createSmokeWorkflowInstance(request, employee, "reject");

  await openWorkflowApproval(page, manager, instance);
  await runPromptedAction(page, "workflow-action-reject", `Từ chối smoke ${runId}`);
  await expect(page.getByTestId("workflow-instance-status")).toContainText("Bị từ chối");
});

test("yêu cầu bổ sung hồ sơ PAYMENT trên UI", async ({ page, request }) => {
  const employee = await apiLogin(request, "employee");
  const manager = await apiLogin(request, "manager");
  const instance = await createSmokeWorkflowInstance(request, employee, "request-info");

  await openWorkflowApproval(page, manager, instance);
  await runPromptedAction(page, "workflow-action-request-info", `Bổ sung smoke ${runId}`);
  await expect(page.getByTestId("workflow-instance-status")).toContainText("Chờ bổ sung");
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
