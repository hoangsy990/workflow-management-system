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

interface TaskRecord {
  id: string;
  code: string;
  title: string;
}

interface WorkflowTemplateRecord {
  id: string;
  code: string;
  name: string;
  versions?: Array<{
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
  approvals?: Array<{
    id: string;
    action?: string | null;
    status: string;
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

async function parseApi<T>(response: APIResponse): Promise<T> {
  const text = await response.text();
  if (!response.ok()) {
    throw new Error(`API ${response.status()} ${response.url()}: ${text}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

async function parseApiWithRetry<T>(requester: () => Promise<APIResponse>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await requester();
    if (response.status() === 429 && attempt < 2) {
      const text = await response.text();
      const retrySeconds = Number(text.match(/retry in (\d+) seconds/i)?.[1] ?? 5);
      await wait(Math.min(retrySeconds * 1000 + 1000, 60_000));
      continue;
    }
    return parseApi<T>(response);
  }
  throw new Error("API retry attempts exhausted");
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
  const paymentTemplate = await getPaymentTemplate(request, employee);
  const slug = uniqueSlug(label);

  return apiPost<WorkflowInstanceRecord>(request, employee, "/workflow-instances", {
    templateId: paymentTemplate.id,
    formData: {
      purpose: `Smoke ${label} ${slug}`,
      amount: 12_000_000,
      vendor: "Playwright Vendor"
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
  await expect(page.getByText(instance.code)).toBeVisible();
}

async function runWorkflowAction(page: Page, testId: string, comment: string) {
  await page.getByTestId(testId).click();
  await expect(page.getByTestId("workflow-action-panel")).toBeVisible();
  await page.getByTestId("workflow-action-comment").fill(comment);
  await page.getByTestId("workflow-action-confirm").click();
}

test("đăng nhập web bằng tài khoản quản trị", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("login-email").fill(accounts.admin.email);
  await page.getByTestId("login-password").fill(accounts.admin.password);
  await page.getByTestId("login-submit").click();

  await expect(page.getByTestId("nav-dashboard")).toBeVisible();
  await expect(page.getByTestId("nav-tasks")).toBeVisible();
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

test("admin reviews role permission preview on UI", async ({ page, request }) => {
  const admin = await apiLogin(request, "admin");

  await openAppWithSession(page, admin);
  await page.getByTestId("nav-roles").click();
  await expect(page.getByTestId("role-card-manager")).toBeVisible();
  await page.getByTestId("role-card-manager").click();
  await expect(page.getByTestId("role-permission-preview")).toBeVisible();
  await expect(page.getByTestId("role-permission-preview").locator("div")).toHaveCount(4);
});

test("admin creates workflow template with dynamic builder", async ({ page, request }) => {
  const admin = await apiLogin(request, "admin");
  const code = `SMOKE_${runId.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`;
  const name = `Smoke workflow ${runId}`;

  await openAppWithSession(page, admin);
  await page.getByTestId("nav-workflowTemplates").click();
  await page.getByTestId("workflow-template-create").click();
  await page.getByTestId("workflow-template-code").fill(code);
  await page.getByTestId("workflow-template-name").fill(name);
  await page.getByTestId("workflow-field-add").click();
  await page.getByTestId("workflow-field-name-2").fill("Ghi chú kiểm thử");
  await page.getByTestId("workflow-field-code-2").fill("smoke_note");
  await page.getByTestId("workflow-step-add").click();
  await page.getByTestId("workflow-step-name-1").fill("Xác nhận sau cùng");
  await page.getByTestId("workflow-step-code-1").fill("final_confirm");
  await page.getByTestId("workflow-condition-toggle-0").check();
  await page.getByTestId("workflow-condition-field-0").selectOption("amount");
  await page.getByTestId("workflow-condition-operator-0").selectOption("gt");
  await page.getByTestId("workflow-condition-value-0").fill("50000000");

  const createResponse = page.waitForResponse((response) => response.url().endsWith("/workflow-templates") && response.request().method() === "POST");
  await page.getByTestId("workflow-template-save").click();
  const created = (await (await createResponse).json()) as WorkflowTemplateRecord;
  const condition = created.versions?.[0]?.transitions?.flatMap((transition) => transition.conditions ?? []).find((item) => item.fieldCode === "amount");
  expect(condition).toMatchObject({ fieldCode: "amount", operator: "gt", compareValue: 50000000 });
  await expect(page.locator(`tr[data-testid="workflow-template-row-${created.id}"]`)).toBeVisible();
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
  await runWorkflowAction(page, "workflow-action-approve", `Duyệt smoke ${runId}`);
  await expect(page.getByTestId("workflow-instance-status")).toContainText(/Đã duyệt|Hoàn thành/);
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
