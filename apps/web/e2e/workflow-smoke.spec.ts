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

const sessionCache = new Map<AccountKey, ApiSession>();

test.describe.configure({ mode: "serial" });

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
  const response = await request.post(`${apiUrl}/auth/login`, {
    data: {
      email: credentials.email,
      password: credentials.password,
      deviceName: "Playwright smoke"
    }
  });
  const session = await parseApi<ApiSession>(response);
  sessionCache.set(account, session);
  return session;
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

async function createSmokeTask(request: APIRequestContext, manager: ApiSession) {
  const users = await apiGet<Paginated<UserRecord>>(request, manager, "/users?pageSize=100");
  const departments = await apiGet<DepartmentRecord[]>(request, manager, "/departments");
  const assignee = users.data.find((user) => user.email === accounts.employee.email) ?? users.data[0];
  const department = assignee?.department ?? departments[0];

  expect(assignee, "Seed employee is required").toBeTruthy();
  expect(department, "Seed department is required").toBeTruthy();

  return apiPost<TaskRecord>(request, manager, "/tasks", {
    title: `Smoke upload ${runId}`,
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

async function createSmokeWorkflowInstance(request: APIRequestContext, employee: ApiSession) {
  const templates = await apiGet<WorkflowTemplateRecord[]>(request, employee, "/workflow-templates");
  const paymentTemplate = templates.find((template) => template.code === "PAYMENT") ?? templates[0];
  expect(paymentTemplate, "Seed payment workflow template is required").toBeTruthy();

  return apiPost<WorkflowInstanceRecord>(request, employee, "/workflow-instances", {
    templateId: paymentTemplate!.id,
    formData: {
      purpose: `Smoke approval ${runId}`,
      amount: 12_000_000,
      vendor: "Playwright Vendor"
    },
    idempotencyKey: `smoke-instance-${runId}`
  });
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

test("duyệt hồ sơ PAYMENT tuần tự trên UI", async ({ page, request }) => {
  const employee = await apiLogin(request, "employee");
  const manager = await apiLogin(request, "manager");
  const instance = await createSmokeWorkflowInstance(request, employee);

  await openAppWithSession(page, manager);
  await page.getByTestId("nav-approvals").click();
  await expect(page.locator(`tr[data-testid="workflow-instance-row-${instance.id}"]`)).toBeVisible();
  await page.locator(`tr[data-testid="workflow-instance-row-${instance.id}"]`).click();
  await expect(page.getByText(instance.code)).toBeVisible();

  page.on("dialog", async (dialog) => {
    if (dialog.type() === "prompt") {
      await dialog.accept(`Duyệt smoke ${runId}`);
      return;
    }
    await dialog.accept();
  });

  await page.getByTestId("workflow-action-approve").click();
  await expect(page.getByText(/Đã duyệt|Hoàn thành/)).toBeVisible();
});
