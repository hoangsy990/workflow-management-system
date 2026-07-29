import {
  Activity,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Columns3,
  Download,
  FileClock,
  Home,
  Loader2,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Sun,
  Upload,
  Users,
  Workflow,
  XCircle
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, ApiUser, getStoredSession, setStoredSession } from "./api/client";
import { DataTable, ErrorBlock, LoadingBlock, MultiCheck } from "./components/common";
import { useAsyncData } from "./hooks/useAsyncData";

type Page =
  | "dashboard"
  | "myTasks"
  | "tasks"
  | "kanban"
  | "calendar"
  | "newTask"
  | "taskDetail"
  | "workflowTemplates"
  | "workflowBuilder"
  | "workflowInstances"
  | "newInstance"
  | "instanceDetail"
  | "approvals"
  | "users"
  | "departments"
  | "roles"
  | "logs"
  | "settings";

interface NavItem {
  page: Page;
  label: string;
  icon: typeof Home;
}

const navItems: NavItem[] = [
  { page: "dashboard", label: "Dashboard", icon: Home },
  { page: "myTasks", label: "Công việc của tôi", icon: ClipboardCheck },
  { page: "tasks", label: "Tất cả công việc", icon: FileClock },
  { page: "kanban", label: "Kanban", icon: Columns3 },
  { page: "calendar", label: "Lịch", icon: CalendarDays },
  { page: "workflowTemplates", label: "Mẫu quy trình", icon: Workflow },
  { page: "workflowInstances", label: "Hồ sơ quy trình", icon: FileClock },
  { page: "approvals", label: "Chờ tôi duyệt", icon: CheckCircle2 },
  { page: "users", label: "Người dùng", icon: Users },
  { page: "departments", label: "Phòng ban", icon: Activity },
  { page: "roles", label: "Vai trò", icon: ShieldCheck },
  { page: "logs", label: "Nhật ký", icon: Activity },
  { page: "settings", label: "Cấu hình", icon: Settings }
];

const mobileNav = navItems.slice(0, 5);

const statusLabels: Record<string, string> = {
  DRAFT: "Bản nháp",
  TODO: "Chưa thực hiện",
  IN_PROGRESS: "Đang thực hiện",
  PAUSED: "Tạm dừng",
  PENDING_REVIEW: "Chờ đánh giá",
  DONE: "Hoàn thành",
  CANCELLED: "Đã hủy",
  OVERDUE: "Quá hạn",
  SUBMITTED: "Đã gửi",
  NEEDS_INFO: "Chờ bổ sung",
  APPROVED: "Đã duyệt",
  REJECTED: "Bị từ chối",
  COMPLETED: "Hoàn thành",
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Ngừng hoạt động"
};

const priorityLabels: Record<string, string> = {
  LOW: "Thấp",
  NORMAL: "Bình thường",
  HIGH: "Cao",
  URGENT: "Khẩn cấp"
};

const permissionGroupLabels: Record<string, string> = {
  user: "Người dùng",
  department: "Phòng ban",
  role: "Vai trò và quyền",
  task: "Công việc",
  workflow: "Quy trình",
  notification: "Thông báo",
  audit: "Nhật ký",
  setting: "Cấu hình"
};

const permissionActionLabels: Record<string, string> = {
  read: "Xem",
  manage: "Quản lý",
  create: "Tạo mới",
  comment: "Bình luận",
  assign: "Giao việc",
  evaluate: "Đánh giá",
  approve: "Phê duyệt",
  read_all: "Xem toàn bộ",
  read_team: "Xem nhóm",
  update_any: "Sửa toàn bộ",
  "template.manage": "Quản lý mẫu",
  "instance.create": "Tạo hồ sơ",
  "instance.approve": "Xử lý hồ sơ",
  "instance.read_all": "Xem mọi hồ sơ"
};

function permissionGroupName(group?: string) {
  if (!group) return "Khác";
  return permissionGroupLabels[group] ?? group;
}

function permissionActionName(code: string) {
  const [, ...parts] = code.split(".");
  const action = parts.join(".");
  return permissionActionLabels[action] ?? action.replace(/_/g, " ");
}

function extractRolePermissionIds(role?: Record<string, any>) {
  return (role?.permissions ?? []).map((item: Record<string, any>) => item.permission.id);
}

function isSameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}

const maxAttachmentMb = 20;
const allowedAttachmentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "video/mp4"
]);
const attachmentAccept = [...allowedAttachmentTypes].join(",");

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh"
  }).format(new Date(value));
}

function formatFileSize(bytes?: number) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function cls(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

function Login({ onLogin }: { onLogin: (user: ApiUser) => void }) {
  const [email, setEmail] = useState("admin@workflow.local");
  const [password, setPassword] = useState("Admin@123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await api.login(email, password, "Web");
      setStoredSession({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      onLogin(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div>
          <p className="eyebrow">WorkFlow Management System</p>
          <h1>Đăng nhập</h1>
        </div>
        <form onSubmit={submit} className="form-stack">
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label>
            Mật khẩu
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading && <Loader2 className="spin" size={16} />}
            Đăng nhập
          </button>
        </form>
        <div className="demo-lines">
          <span>Admin: admin@workflow.local / Admin@123456</span>
          <span>Quản lý: manager@workflow.local / Manager@123456</span>
        </div>
      </section>
    </main>
  );
}

function AppShell({
  user,
  page,
  setPage,
  children,
  onLogout,
  unread,
  dark,
  setDark,
  online
}: {
  user: ApiUser;
  page: Page;
  setPage: (page: Page) => void;
  children: React.ReactNode;
  onLogout: () => void;
  unread: number;
  dark: boolean;
  setDark: (value: boolean) => void;
  online: boolean;
}) {
  const activeItem = navItems.find((item) => item.page === page);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function goToPage(nextPage: Page) {
    setPage(nextPage);
    setMobileMenuOpen(false);
  }

  return (
    <div className={cls("app-shell", dark && "dark")}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">WF</div>
          <div>
            <strong>WorkFlow</strong>
            <span>Management System</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.page}
                className={cls("nav-item", page === item.page && "active")}
                onClick={() => goToPage(item.page)}
                type="button"
                title={item.label}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="menu-trigger"
              type="button"
              title="Mở menu"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <Menu size={18} />
            </button>
            <span>{activeItem?.label ?? "Dashboard"}</span>
          </div>
          <div className="top-actions">
            <span className={cls("sync-pill", online ? "online" : "offline")}>
              <Smartphone size={14} />
              {online ? "Đang kết nối" : "Mất kết nối"}
            </span>
            <button className="icon-button" type="button" title="Đổi giao diện" onClick={() => setDark(!dark)}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="icon-button" type="button" title="Thông báo" onClick={() => setPage("dashboard")}>
              <Bell size={18} />
              {unread > 0 && <b>{unread}</b>}
            </button>
            <div className="account-menu">
              <span>{user.fullName}</span>
              <button className="icon-button" type="button" title="Đăng xuất" onClick={onLogout}>
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {mobileMenuOpen && (
          <nav className="mobile-menu-panel">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.page}
                  className={cls(page === item.page && "active")}
                  type="button"
                  onClick={() => goToPage(item.page)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        <main className="content">{children}</main>
      </div>

      <nav className="bottom-nav">
        {mobileNav.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.page}
              className={page === item.page ? "active" : ""}
              onClick={() => goToPage(item.page)}
              type="button"
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function Dashboard({ setPage, setTaskId, setInstanceId }: PageProps) {
  const { data, loading, error } = useAsyncData(() => api.dashboard(), []);
  const notifications = useAsyncData(() => api.notifications(), []);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;

  const cards = data?.cards ?? {};
  const cardItems = [
    ["Đang thực hiện", cards.activeTasks, "tasks"],
    ["Chờ xử lý", cards.pendingTasks, "myTasks"],
    ["Sắp đến hạn", cards.dueSoon, "tasks"],
    ["Quá hạn", cards.overdue, "tasks"],
    ["Chờ đánh giá", cards.pendingReview, "myTasks"],
    ["Chờ tôi duyệt", cards.approvalPendingMine, "approvals"],
    ["Hồ sơ tôi tạo", cards.myInstances, "workflowInstances"]
  ] as const;

  return (
    <section className="page-grid">
      <div className="metric-grid">
        {cardItems.map(([label, value, target]) => (
          <button key={label} className="metric-card" type="button" onClick={() => setPage(target)}>
            <span>{label}</span>
            <strong>{value ?? 0}</strong>
          </button>
        ))}
      </div>

      <section className="panel wide">
        <div className="panel-head">
          <h2>Công việc cần chú ý</h2>
        </div>
        <DataTable
          columns={["Mã", "Tên công việc", "Trạng thái", "Tiến độ", "Hạn"]}
          rows={(data?.attentionTasks ?? []).map((task: Record<string, any>) => ({
            key: task.id,
            onClick: () => {
              setTaskId(task.id);
              setPage("taskDetail");
            },
            cells: [task.code, task.title, statusLabels[task.displayStatus ?? task.status], `${task.progress}%`, formatDate(task.dueDate)]
          }))}
        />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Thống kê trạng thái</h2>
        </div>
        <div className="bar-list">
          {(data?.tasksByStatus ?? []).map((item: Record<string, any>) => (
            <div key={item.status}>
              <span>{statusLabels[item.status] ?? item.status}</span>
              <strong>{item._count}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Hồ sơ gần nhất</h2>
        </div>
        <div className="stack-list">
          {(data?.recentInstances ?? []).map((instance: Record<string, any>) => (
            <button
              key={instance.id}
              type="button"
              onClick={() => {
                setInstanceId(instance.id);
                setPage("instanceDetail");
              }}
            >
              <strong>{instance.code}</strong>
              <span>{instance.template?.name}</span>
              <small>{statusLabels[instance.status] ?? instance.status}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Thông báo</h2>
        </div>
        {notifications.loading ? (
          <LoadingBlock />
        ) : (
          <div className="stack-list">
            {(notifications.data?.data ?? []).map((item: Record<string, any>) => (
              <button key={item.id} type="button">
                <strong>{item.title}</strong>
                <span>{item.content}</span>
                <small>{formatDate(item.createdAt)}</small>
              </button>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

interface PageProps {
  setPage: (page: Page) => void;
  setTaskId: (id: string) => void;
  setInstanceId: (id: string) => void;
}

function TaskList({ mode, setPage, setTaskId }: PageProps & { mode: "all" | "mine" }) {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const query = useMemo(() => {
    const params = new URLSearchParams({ pageSize: "50" });
    if (keyword) params.set("keyword", keyword);
    if (status) params.set("status", status);
    if (mode === "mine") params.set("myView", "assignee");
    return `?${params.toString()}`;
  }, [keyword, status, mode]);
  const { data, loading, error, reload } = useAsyncData(() => api.tasks(query), [query]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;

  return (
    <section className="panel">
      <div className="panel-head wrap">
        <h2>{mode === "mine" ? "Công việc của tôi" : "Danh sách công việc"}</h2>
        <div className="toolbar">
          <label className="search-box">
            <Search size={16} />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm kiếm" />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(statusLabels)
              .filter(([key]) => ["DRAFT", "TODO", "IN_PROGRESS", "PAUSED", "PENDING_REVIEW", "DONE", "CANCELLED"].includes(key))
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </select>
          <button className="primary-button compact" type="button" onClick={() => setPage("newTask")}>
            <Plus size={16} />
            Tạo công việc
          </button>
          <button className="ghost-button compact" type="button" onClick={() => void reload()}>
            Làm mới
          </button>
        </div>
      </div>
      <DataTable
        columns={["Mã", "Tên công việc", "Trạng thái", "Tiến độ", "Người thực hiện", "Ưu tiên", "Hạn"]}
        rows={(data?.data ?? []).map((task) => ({
          key: task.id,
          onClick: () => {
            setTaskId(task.id);
            setPage("taskDetail");
          },
          cells: [
            task.code,
            task.title,
            <span className={cls("status-chip", task.displayStatus)}>{statusLabels[task.displayStatus ?? task.status]}</span>,
            `${task.progress}%`,
            task.assignees?.map((item: Record<string, any>) => item.user.fullName).join(", ") ?? "",
            priorityLabels[task.priority] ?? task.priority,
            formatDate(task.dueDate)
          ]
        }))}
      />
    </section>
  );
}

function Kanban({ setPage, setTaskId }: PageProps) {
  const { data, loading, error, reload } = useAsyncData(() => api.tasks("?pageSize=100"), []);
  const statuses = ["TODO", "IN_PROGRESS", "PAUSED", "PENDING_REVIEW", "DONE", "CANCELLED"];

  async function moveTask(taskId: string, status: string) {
    const confirmImportant = ["DONE", "CANCELLED"].includes(status)
      ? window.confirm("Xác nhận chuyển trạng thái quan trọng?")
      : true;
    if (!confirmImportant) return;
    await api.updateTask(taskId, { status });
    await reload();
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;

  return (
    <div className="kanban">
      {statuses.map((status) => (
        <section
          key={status}
          className="kanban-column"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => void moveTask(event.dataTransfer.getData("taskId"), status)}
        >
          <h3>{statusLabels[status]}</h3>
          {(data?.data ?? [])
            .filter((task) => task.status === status)
            .map((task) => (
              <button
                key={task.id}
                className="kanban-card"
                draggable
                onDragStart={(event) => event.dataTransfer.setData("taskId", task.id)}
                onClick={() => {
                  setTaskId(task.id);
                  setPage("taskDetail");
                }}
                type="button"
              >
                <strong>{task.title}</strong>
                <span>{task.code}</span>
                <progress value={task.progress} max={100} />
              </button>
            ))}
        </section>
      ))}
    </div>
  );
}

function CalendarPage({ setPage, setTaskId }: PageProps) {
  const { data, loading, error } = useAsyncData(() => api.tasks("?pageSize=100"), []);
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  const grouped = new Map<string, Record<string, any>[]>();
  for (const task of data?.data ?? []) {
    const key = formatDate(task.dueDate) || "Chưa có hạn";
    grouped.set(key, [...(grouped.get(key) ?? []), task]);
  }
  return (
    <section className="calendar-list">
      {[...grouped.entries()].map(([date, tasks]) => (
        <div className="panel" key={date}>
          <div className="panel-head">
            <h2>{date}</h2>
          </div>
          <div className="stack-list">
            {tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => {
                  setTaskId(task.id);
                  setPage("taskDetail");
                }}
              >
                <strong>{task.title}</strong>
                <span>{task.code}</span>
                <small>{statusLabels[task.displayStatus ?? task.status]}</small>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function TaskForm({ setPage, setTaskId }: PageProps) {
  const users = useAsyncData(() => api.users(), []);
  const departments = useAsyncData(() => api.departments(), []);
  const categories = useAsyncData(() => api.taskCategories(), []);
  const tags = useAsyncData(() => api.tags(), []);
  const draftKey = "workflow.task.draft";
  const initial = useMemo(() => {
    const stored = localStorage.getItem(draftKey);
    return stored ? JSON.parse(stored) : {};
  }, []);
  const [form, setForm] = useState<Record<string, any>>({
    title: initial.title ?? "",
    description: initial.description ?? "",
    assigneeIds: initial.assigneeIds ?? [],
    followerIds: initial.followerIds ?? [],
    managerId: initial.managerId ?? "",
    departmentId: initial.departmentId ?? "",
    priority: initial.priority ?? "NORMAL",
    startDate: initial.startDate ?? "",
    dueDate: initial.dueDate ?? "",
    categoryId: initial.categoryId ?? "",
    tagIds: initial.tagIds ?? [],
    requiresReview: initial.requiresReview ?? true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify(form));
  }, [form]);

  function update(key: string, value: unknown) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const task = await api.createTask({
        ...form,
        managerId: form.managerId || undefined,
        departmentId: form.departmentId || undefined,
        categoryId: form.categoryId || undefined,
        startDate: form.startDate || undefined,
        dueDate: form.dueDate || undefined
      });
      localStorage.removeItem(draftKey);
      setTaskId(task.id);
      setPage("taskDetail");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được công việc.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="panel form-grid" onSubmit={submit}>
      <div className="panel-head full">
        <h2>Tạo công việc</h2>
      </div>
      <fieldset>
        <legend>Thông tin chính</legend>
        <label>
          Tên công việc
          <input value={form.title} onChange={(event) => update("title", event.target.value)} required minLength={3} />
        </label>
        <label>
          Mô tả
          <textarea value={form.description} onChange={(event) => update("description", event.target.value)} rows={5} />
        </label>
        <label>
          Mức độ ưu tiên
          <select value={form.priority} onChange={(event) => update("priority", event.target.value)}>
            {Object.entries(priorityLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <fieldset>
        <legend>Người tham gia</legend>
        <label>
          Người quản lý công việc
          <select value={form.managerId} onChange={(event) => update("managerId", event.target.value)}>
            <option value="">Chọn người quản lý</option>
            {(users.data?.data ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName}
              </option>
            ))}
          </select>
        </label>
        <MultiCheck
          label="Người thực hiện"
          items={users.data?.data ?? []}
          value={form.assigneeIds}
          onChange={(value) => update("assigneeIds", value)}
        />
        <MultiCheck
          label="Người theo dõi"
          items={users.data?.data ?? []}
          value={form.followerIds}
          onChange={(value) => update("followerIds", value)}
        />
      </fieldset>
      <fieldset>
        <legend>Thời gian và phân loại</legend>
        <label>
          Phòng ban phụ trách
          <select value={form.departmentId} onChange={(event) => update("departmentId", event.target.value)}>
            <option value="">Chọn phòng ban</option>
            {(departments.data ?? []).map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ngày bắt đầu
          <input type="date" value={form.startDate} onChange={(event) => update("startDate", event.target.value)} />
        </label>
        <label>
          Hạn hoàn thành
          <input type="date" value={form.dueDate} onChange={(event) => update("dueDate", event.target.value)} />
        </label>
        <label>
          Danh mục
          <select value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)}>
            <option value="">Chọn danh mục</option>
            {(categories.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <MultiCheck
          label="Nhãn"
          items={tags.data ?? []}
          value={form.tagIds}
          onChange={(value) => update("tagIds", value)}
        />
        <label className="toggle-line">
          <input
            type="checkbox"
            checked={form.requiresReview}
            onChange={(event) => update("requiresReview", event.target.checked)}
          />
          Cần đánh giá khi hoàn thành
        </label>
      </fieldset>
      {error && <p className="form-error full">{error}</p>}
      <div className="form-actions full">
        <button className="ghost-button" type="button" onClick={() => setPage("tasks")}>
          Hủy
        </button>
        <button className="primary-button" type="submit" disabled={loading}>
          {loading && <Loader2 className="spin" size={16} />}
          Lưu công việc
        </button>
      </div>
    </form>
  );
}

function TaskDetail({ taskId, setPage }: { taskId: string | null; setPage: (page: Page) => void }) {
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  const [commentMentions, setCommentMentions] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");
  const { data, loading, error, reload } = useAsyncData(() => (taskId ? api.task(taskId) : Promise.resolve(null)), [taskId]);

  useEffect(() => {
    if (data?.progress !== undefined) setProgress(data.progress);
  }, [data?.progress]);

  const mentionableUsers = useMemo(() => {
    const users = [
      data?.creator,
      data?.assigner,
      data?.manager,
      ...(data?.assignees ?? []).map((item: Record<string, any>) => item.user),
      ...(data?.followers ?? []).map((item: Record<string, any>) => item.user)
    ].filter(Boolean) as Array<{ id: string; fullName: string }>;
    return [...new Map(users.map((user) => [user.id, user])).values()];
  }, [data]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    setLocalError("");
    const nextFiles: File[] = [];
    for (const file of Array.from(files)) {
      if (!allowedAttachmentTypes.has(file.type)) {
        setLocalError(`Tệp ${file.name} không đúng định dạng cho phép.`);
        continue;
      }
      if (file.size > maxAttachmentMb * 1024 * 1024) {
        setLocalError(`Tệp ${file.name} vượt quá ${maxAttachmentMb} MB.`);
        continue;
      }
      nextFiles.push(file);
    }
    setSelectedFiles((current) => [...current, ...nextFiles]);
  }

  async function downloadAttachment(attachment: Record<string, any>) {
    setDownloadingId(attachment.id);
    setLocalError("");
    try {
      const { blob, filename } = await api.downloadAttachment(attachment.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || attachment.originalName || "download";
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Không tải được tệp.");
    } finally {
      setDownloadingId(null);
    }
  }

  async function saveProgress() {
    if (!taskId) return;
    setBusy(true);
    setLocalError("");
    try {
      await api.updateTaskProgress(taskId, progress, note);
      setNote("");
      await reload();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Không cập nhật được tiến độ.");
    } finally {
      setBusy(false);
    }
  }

  async function evaluate(accepted: boolean) {
    if (!taskId) return;
    const commentText = window.prompt(accepted ? "Nhận xét hoàn thành" : "Lý do yêu cầu làm lại") ?? "";
    if (!window.confirm(accepted ? "Xác nhận hoàn thành công việc?" : "Yêu cầu thực hiện lại công việc?")) return;
    setBusy(true);
    setLocalError("");
    try {
      await api.evaluateTask(taskId, { accepted, rating: accepted ? 5 : undefined, comment: commentText });
      await reload();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Không đánh giá được công việc.");
    } finally {
      setBusy(false);
    }
  }

  async function sendComment(event: FormEvent) {
    event.preventDefault();
    if (!taskId || (!comment.trim() && selectedFiles.length === 0)) return;
    setBusy(true);
    setLocalError("");
    try {
      const uploaded: Record<string, any>[] = [];
      for (const file of selectedFiles) {
        uploaded.push(await api.uploadTaskAttachment(taskId, file));
      }
      await api.commentTask(taskId, {
        content: comment.trim() || "Đã đính kèm tệp.",
        mentions: commentMentions,
        attachmentIds: uploaded.map((attachment) => attachment.id)
      });
      setComment("");
      setSelectedFiles([]);
      setCommentMentions([]);
      await reload();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Không gửi được bình luận.");
    } finally {
      setBusy(false);
    }
  }

  if (!taskId) return <ErrorBlock message="Chưa chọn công việc." />;
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  if (!data) return <ErrorBlock message="Không tìm thấy công việc." />;

  return (
    <section className="detail-grid">
      <article className="panel detail-main">
        <div className="panel-head">
          <div>
            <h2>{data.title}</h2>
            <p>{data.code}</p>
          </div>
          <span className={cls("status-chip", data.displayStatus)}>{statusLabels[data.displayStatus ?? data.status]}</span>
        </div>
        <p className="description">{data.description}</p>
        {localError && <p className="form-error">{localError}</p>}
        <div className="info-grid">
          <span>
            <small>Ưu tiên</small>
            <b>{priorityLabels[data.priority]}</b>
          </span>
          <span>
            <small>Phòng ban</small>
            <b>{data.department?.name ?? ""}</b>
          </span>
          <span>
            <small>Hạn hoàn thành</small>
            <b>{formatDate(data.dueDate)}</b>
          </span>
          <span>
            <small>Tiến độ</small>
            <b>{data.progress}%</b>
          </span>
        </div>
        <section className="attachment-section">
          <div className="subhead">
            <h3>Tệp đính kèm</h3>
            <span>{data.attachments?.length ?? 0}</span>
          </div>
          <AttachmentList
            attachments={data.attachments ?? []}
            downloadingId={downloadingId}
            onDownload={(attachment) => void downloadAttachment(attachment)}
          />
        </section>
        <div className="progress-box">
          <input type="range" min={0} max={100} value={progress} onChange={(event) => setProgress(Number(event.target.value))} />
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú tiến độ" />
          <button className="primary-button compact" type="button" disabled={busy} onClick={() => void saveProgress()}>
            Cập nhật tiến độ
          </button>
        </div>
        <div className="approval-actions">
          <button className="primary-button" type="button" disabled={busy} onClick={() => void evaluate(true)}>
            Xác nhận hoàn thành
          </button>
          <button className="danger-button" type="button" disabled={busy} onClick={() => void evaluate(false)}>
            Yêu cầu làm lại
          </button>
        </div>
      </article>

      <aside className="panel">
        <div className="panel-head">
          <h2>Trao đổi</h2>
        </div>
        <div className="comment-list">
          {(data.comments ?? []).map((item: Record<string, any>) => (
            <div key={item.id}>
              <strong>{item.author?.fullName}</strong>
              <p>{item.content}</p>
              <AttachmentList
                attachments={item.attachments ?? []}
                downloadingId={downloadingId}
                onDownload={(attachment) => void downloadAttachment(attachment)}
              />
              <small>{formatDate(item.createdAt)}</small>
            </div>
          ))}
        </div>
        <form className="comment-form" onSubmit={sendComment}>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Nhập bình luận" />
          <div className="comment-tools">
            <div className="mention-picker">
              <span>Nhắc tên</span>
              <div>
                {mentionableUsers.map((user) => (
                  <label key={user.id}>
                    <input
                      type="checkbox"
                      checked={commentMentions.includes(user.id)}
                      onChange={(event) => {
                        setCommentMentions((current) =>
                          event.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id)
                        );
                      }}
                    />
                    {user.fullName}
                  </label>
                ))}
              </div>
            </div>
            <label className="file-picker">
              <Upload size={16} />
              Chọn tệp
              <input
                type="file"
                multiple
                accept={attachmentAccept}
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
          {selectedFiles.length > 0 && (
            <div className="selected-files">
              {selectedFiles.map((file, index) => (
                <span key={`${file.name}-${file.lastModified}-${index}`}>
                  <b>{file.name}</b>
                  <small>{formatFileSize(file.size)}</small>
                  <button
                    type="button"
                    title="Bỏ tệp"
                    onClick={() => setSelectedFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                  >
                    <XCircle size={16} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <button className="primary-button compact" type="submit" disabled={busy}>
            {busy && <Loader2 className="spin" size={16} />}
            Gửi
          </button>
        </form>
      </aside>

      <section className="panel wide">
        <div className="panel-head">
          <h2>Lịch sử tiến độ</h2>
          <button className="ghost-button compact" type="button" onClick={() => setPage("tasks")}>
            Quay lại
          </button>
        </div>
        <DataTable
          columns={["Người cập nhật", "Tiến độ", "Trạng thái", "Ghi chú", "Thời gian"]}
          rows={(data.progressLogs ?? []).map((log: Record<string, any>) => ({
            key: log.id,
            cells: [log.user?.fullName, `${log.progress}%`, statusLabels[log.newStatus] ?? log.newStatus, log.note, formatDate(log.createdAt)]
          }))}
        />
      </section>
    </section>
  );
}

function AttachmentList({
  attachments,
  downloadingId,
  onDownload
}: {
  attachments: Record<string, any>[];
  downloadingId: string | null;
  onDownload: (attachment: Record<string, any>) => void;
}) {
  if (attachments.length === 0) {
    return <p className="empty-text tight">Chưa có tệp.</p>;
  }

  return (
    <div className="attachment-list">
      {attachments.map((attachment) => (
        <button key={attachment.id} type="button" onClick={() => onDownload(attachment)} disabled={downloadingId === attachment.id}>
          {downloadingId === attachment.id ? <Loader2 className="spin" size={16} /> : <Download size={16} />}
          <span>
            <b>{attachment.originalName}</b>
            <small>{formatFileSize(attachment.sizeBytes)}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

function WorkflowTemplates({ setPage }: PageProps) {
  const { data, loading, error } = useAsyncData(() => api.workflowTemplates(), []);
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  return (
    <section className="panel">
      <div className="panel-head wrap">
        <h2>Mẫu quy trình</h2>
        <button className="primary-button compact" type="button" onClick={() => setPage("workflowBuilder")}>
          <Plus size={16} />
          Tạo mẫu
        </button>
      </div>
      <DataTable
        columns={["Mã", "Tên", "Danh mục", "Trạng thái", "Phiên bản"]}
        rows={(data ?? []).map((template) => ({
          key: template.id,
          cells: [
            template.code,
            template.name,
            template.category,
            statusLabels[template.status] ?? template.status,
            template.versions?.[0]?.versionNo ?? 1
          ]
        }))}
      />
    </section>
  );
}

function WorkflowBuilder({ setPage }: PageProps) {
  const [form, setForm] = useState({
    code: "",
    name: "",
    category: "",
    description: "",
    amountField: true
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const fields = form.amountField
        ? [
            { name: "Nội dung", code: "purpose", type: "SHORT_TEXT", isRequired: true, displayOrder: 1 },
            { name: "Số tiền", code: "amount", type: "CURRENCY", isRequired: true, displayOrder: 2 }
          ]
        : [
            { name: "Tiêu đề", code: "title", type: "SHORT_TEXT", isRequired: true, displayOrder: 1 },
            { name: "Nội dung", code: "content", type: "LONG_TEXT", isRequired: true, displayOrder: 2 }
          ];
      await api.createWorkflowTemplate({
        code: form.code,
        name: form.name,
        category: form.category,
        description: form.description,
        activate: true,
        fields,
        steps: [
          { code: "start", name: "Bắt đầu", type: "START", orderIndex: 1 },
          {
            code: "manager",
            name: "Quản lý trực tiếp duyệt",
            type: "APPROVAL",
            orderIndex: 2,
            approvalMode: "SEQUENTIAL",
            assignees: [{ resolverType: "REQUESTER_MANAGER", orderIndex: 1 }]
          },
          { code: "end", name: "Kết thúc", type: "END", orderIndex: 3 }
        ],
        transitions: [{ fromStepCode: "manager", toStepCode: "end", priority: 1 }]
      });
      setPage("workflowTemplates");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được mẫu quy trình.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="panel form-grid" onSubmit={submit}>
      <div className="panel-head full">
        <h2>Tạo mẫu quy trình</h2>
      </div>
      <fieldset>
        <legend>Thông tin mẫu</legend>
        <label>
          Mã quy trình
          <input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required />
        </label>
        <label>
          Tên quy trình
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label>
          Danh mục
          <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
        </label>
        <label>
          Mô tả
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </label>
      </fieldset>
      <fieldset>
        <legend>Biểu mẫu và bước duyệt</legend>
        <label className="toggle-line">
          <input
            type="checkbox"
            checked={form.amountField}
            onChange={(event) => setForm({ ...form, amountField: event.target.checked })}
          />
          Có trường số tiền
        </label>
        <div className="step-preview">
          <span>Bắt đầu</span>
          <span>Quản lý trực tiếp duyệt</span>
          <span>Kết thúc</span>
        </div>
      </fieldset>
      {error && <p className="form-error full">{error}</p>}
      <div className="form-actions full">
        <button className="ghost-button" type="button" onClick={() => setPage("workflowTemplates")}>
          Hủy
        </button>
        <button className="primary-button" type="submit" disabled={loading}>
          {loading && <Loader2 className="spin" size={16} />}
          Lưu mẫu
        </button>
      </div>
    </form>
  );
}

function WorkflowInstances({ setPage, setInstanceId, pendingMine = false }: PageProps & { pendingMine?: boolean }) {
  const query = pendingMine ? "?pendingMine=true&pageSize=50" : "?pageSize=50";
  const { data, loading, error } = useAsyncData(() => api.workflowInstances(query), [query]);
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  return (
    <section className="panel">
      <div className="panel-head wrap">
        <h2>{pendingMine ? "Yêu cầu chờ tôi phê duyệt" : "Hồ sơ quy trình"}</h2>
        <button className="primary-button compact" type="button" onClick={() => setPage("newInstance")}>
          <Plus size={16} />
          Tạo hồ sơ
        </button>
      </div>
      <DataTable
        columns={["Mã hồ sơ", "Quy trình", "Bước hiện tại", "Người chờ xử lý", "Trạng thái", "Ngày tạo"]}
        rows={(data?.data ?? []).map((instance) => ({
          key: instance.id,
          onClick: () => {
            setInstanceId(instance.id);
            setPage("instanceDetail");
          },
          cells: [
            instance.code,
            instance.template?.name,
            instance.currentStep?.name,
            instance.approvals?.map((item: Record<string, any>) => item.approver.fullName).join(", "),
            statusLabels[instance.status] ?? instance.status,
            formatDate(instance.createdAt)
          ]
        }))}
      />
    </section>
  );
}

function NewWorkflowInstance({ setPage, setInstanceId }: PageProps) {
  const templates = useAsyncData(() => api.workflowTemplates(), []);
  const [templateId, setTemplateId] = useState("");
  const [json, setJson] = useState('{"purpose":"Đề xuất mới","amount":10000000}');
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const instance = await api.submitWorkflowInstance({
        templateId,
        formData: JSON.parse(json) as Record<string, unknown>,
        idempotencyKey: crypto.randomUUID()
      });
      setInstanceId(instance.id);
      setPage("instanceDetail");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được hồ sơ.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="panel form-stack" onSubmit={submit}>
      <div className="panel-head">
        <h2>Tạo hồ sơ quy trình</h2>
      </div>
      <label>
        Mẫu quy trình
        <select value={templateId} onChange={(event) => setTemplateId(event.target.value)} required>
          <option value="">Chọn mẫu</option>
          {(templates.data ?? []).map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Dữ liệu biểu mẫu
        <textarea value={json} onChange={(event) => setJson(event.target.value)} rows={8} />
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button className="ghost-button" type="button" onClick={() => setPage("workflowInstances")}>
          Hủy
        </button>
        <button className="primary-button" type="submit" disabled={loading}>
          {loading && <Loader2 className="spin" size={16} />}
          Gửi hồ sơ
        </button>
      </div>
    </form>
  );
}

function WorkflowInstanceDetail({ instanceId, setPage }: { instanceId: string | null; setPage: (page: Page) => void }) {
  const { data, loading, error, reload } = useAsyncData(
    () => (instanceId ? api.workflowInstance(instanceId) : Promise.resolve(null)),
    [instanceId]
  );
  const [busy, setBusy] = useState(false);

  async function act(action: "APPROVE" | "REJECT" | "REQUEST_INFO" | "RETURN") {
    if (!instanceId) return;
    const comment = window.prompt("Ý kiến xử lý") ?? "";
    if (!window.confirm("Xác nhận thao tác?")) return;
    setBusy(true);
    await api.actWorkflow(instanceId, { action, comment, idempotencyKey: crypto.randomUUID() });
    setBusy(false);
    await reload();
  }

  if (!instanceId) return <ErrorBlock message="Chưa chọn hồ sơ." />;
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  if (!data) return <ErrorBlock message="Không tìm thấy hồ sơ." />;

  return (
    <section className="detail-grid">
      <article className="panel detail-main">
        <div className="panel-head">
          <div>
            <h2>{data.code}</h2>
            <p>{data.template?.name}</p>
          </div>
          <span className="status-chip">{statusLabels[data.status] ?? data.status}</span>
        </div>
        <div className="json-view">{JSON.stringify(data.formData ?? {}, null, 2)}</div>
        <div className="approval-actions">
          <button className="primary-button" type="button" disabled={busy} onClick={() => void act("APPROVE")}>
            Duyệt
          </button>
          <button className="danger-button" type="button" disabled={busy} onClick={() => void act("REJECT")}>
            Từ chối
          </button>
          <button className="ghost-button" type="button" disabled={busy} onClick={() => void act("REQUEST_INFO")}>
            Yêu cầu bổ sung
          </button>
          <button className="ghost-button" type="button" disabled={busy} onClick={() => void act("RETURN")}>
            Trả bước
          </button>
        </div>
      </article>
      <section className="panel">
        <div className="panel-head">
          <h2>Lịch sử xử lý</h2>
          <button className="ghost-button compact" type="button" onClick={() => setPage("workflowInstances")}>
            Quay lại
          </button>
        </div>
        <div className="timeline">
          {(data.approvals ?? []).map((approval: Record<string, any>) => (
            <div key={approval.id}>
              <strong>{approval.approver?.fullName}</strong>
              <span>{approval.step?.name}</span>
              <small>{approval.action ?? approval.status}</small>
              {approval.comment && <p>{approval.comment}</p>}
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function UsersPage() {
  const { data, loading, error, reload } = useAsyncData(() => api.users(), []);
  const departments = useAsyncData(() => api.departments(), []);
  const roles = useAsyncData(() => api.roles(), []);
  const [form, setForm] = useState<Record<string, any>>({
    employeeCode: "",
    fullName: "",
    email: "",
    password: "Demo@123456",
    departmentId: "",
    roleIds: []
  });
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    await api.createUser({ ...form, departmentId: form.departmentId || undefined });
    setSaving(false);
    setForm({ employeeCode: "", fullName: "", email: "", password: "Demo@123456", departmentId: "", roleIds: [] });
    await reload();
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;

  return (
    <section className="page-grid">
      <form className="panel form-stack" onSubmit={submit}>
        <div className="panel-head">
          <h2>Tạo người dùng</h2>
        </div>
        <input placeholder="Mã nhân viên" value={form.employeeCode} onChange={(event) => setForm({ ...form, employeeCode: event.target.value })} required />
        <input placeholder="Họ tên" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
        <input placeholder="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        <input placeholder="Mật khẩu" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
        <select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}>
          <option value="">Phòng ban</option>
          {(departments.data ?? []).map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <MultiCheck
          label="Vai trò"
          items={roles.data ?? []}
          value={form.roleIds}
          onChange={(value) => setForm({ ...form, roleIds: value })}
        />
        <button className="primary-button" type="submit" disabled={saving}>
          Lưu người dùng
        </button>
      </form>
      <section className="panel wide">
        <div className="panel-head">
          <h2>Danh sách người dùng</h2>
        </div>
        <DataTable
          columns={["Mã", "Họ tên", "Email", "Phòng ban", "Vai trò", "Trạng thái"]}
          rows={(data?.data ?? []).map((user) => ({
            key: user.id,
            cells: [
              user.employeeCode,
              user.fullName,
              user.email,
              user.department?.name,
              user.roles?.map((item: Record<string, any>) => item.role.name).join(", "),
              user.status
            ]
          }))}
        />
      </section>
    </section>
  );
}

function DepartmentsPage() {
  const { data, loading, error, reload } = useAsyncData(() => api.departments(), []);
  const users = useAsyncData(() => api.users(), []);
  const [form, setForm] = useState({ code: "", name: "", managerId: "" });
  async function submit(event: FormEvent) {
    event.preventDefault();
    await api.saveDepartment({ ...form, managerId: form.managerId || undefined });
    setForm({ code: "", name: "", managerId: "" });
    await reload();
  }
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  return (
    <section className="page-grid">
      <form className="panel form-stack" onSubmit={submit}>
        <div className="panel-head">
          <h2>Tạo phòng ban</h2>
        </div>
        <input placeholder="Mã phòng ban" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required />
        <input placeholder="Tên phòng ban" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <select value={form.managerId} onChange={(event) => setForm({ ...form, managerId: event.target.value })}>
          <option value="">Quản lý</option>
          {(users.data?.data ?? []).map((user) => (
            <option key={user.id} value={user.id}>
              {user.fullName}
            </option>
          ))}
        </select>
        <button className="primary-button" type="submit">
          Lưu phòng ban
        </button>
      </form>
      <section className="panel wide">
        <div className="panel-head">
          <h2>Cơ cấu tổ chức</h2>
        </div>
        <DataTable
          columns={["Mã", "Tên", "Quản lý", "Nhân sự", "Công việc"]}
          rows={(data ?? []).map((department) => ({
            key: department.id,
            cells: [department.code, department.name, department.manager?.fullName, department._count?.users, department._count?.tasks]
          }))}
        />
      </section>
    </section>
  );
}

function RolesPage() {
  const { data, loading, error, reload } = useAsyncData(() => api.roles(), []);
  const permissions = useAsyncData(() => api.permissions(), []);
  const [selected, setSelected] = useState("");
  const [permissionIds, setPermissionIds] = useState<string[]>([]);
  const [copySource, setCopySource] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const selectedRole = useMemo(() => (data ?? []).find((item) => item.id === selected), [data, selected]);
  const savedPermissionIds = useMemo(() => extractRolePermissionIds(selectedRole), [selectedRole]);
  const selectedPermissionSet = useMemo(() => new Set(permissionIds), [permissionIds]);
  const hasChanges = !isSameStringSet(permissionIds, savedPermissionIds);
  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, Record<string, any>[]>();
    for (const permission of permissions.data ?? []) {
      const group = permission.group ?? "system";
      groups.set(group, [...(groups.get(group) ?? []), permission]);
    }
    return [...groups.entries()]
      .map(([group, items]) => ({
        group,
        label: permissionGroupName(group),
        items: items.sort((left, right) => left.code.localeCompare(right.code))
      }))
      .sort((left, right) => left.label.localeCompare(right.label, "vi"));
  }, [permissions.data]);

  useEffect(() => {
    const firstRole = data?.[0];
    if (!selected && firstRole) {
      setSelected(firstRole.id);
    }
  }, [data, selected]);

  useEffect(() => {
    if (selectedRole) {
      setPermissionIds(savedPermissionIds);
      setCopySource("");
      setSaveError("");
    }
  }, [selectedRole, savedPermissionIds]);

  async function save() {
    if (!selected || saving) return;
    if (!hasChanges) return;
    if (!window.confirm("Xác nhận lưu thay đổi quyền cho vai trò này?")) return;
    setSaving(true);
    setSaveError("");
    try {
      await api.updateRolePermissions(selected, permissionIds);
      await reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Không lưu được quyền hạn.");
    } finally {
      setSaving(false);
    }
  }

  function setPermission(permissionId: string, checked: boolean) {
    setPermissionIds((current) => {
      if (checked) return [...new Set([...current, permissionId])];
      return current.filter((item) => item !== permissionId);
    });
  }

  function setPermissionGroup(groupIds: string[], checked: boolean) {
    setPermissionIds((current) => {
      if (checked) return [...new Set([...current, ...groupIds])];
      const groupSet = new Set(groupIds);
      return current.filter((item) => !groupSet.has(item));
    });
  }

  function copyPermissionsFromRole() {
    const source = (data ?? []).find((role) => role.id === copySource);
    if (!source) return;
    setPermissionIds(extractRolePermissionIds(source));
    setSaveError("");
  }

  function resetPermissions() {
    setPermissionIds(savedPermissionIds);
    setSaveError("");
  }

  if (loading || permissions.loading) return <LoadingBlock />;
  if (error || permissions.error) return <ErrorBlock message={error || permissions.error} />;

  return (
    <section className="permission-layout">
      <section className="panel role-list-panel">
        <div className="panel-head">
          <div>
            <h2>Vai trò</h2>
            <p>Chọn vai trò để cấu hình quyền backend.</p>
          </div>
        </div>
        <div className="role-list">
          {(data ?? []).map((role) => (
            <button
              key={role.id}
              className={cls("role-card", selected === role.id && "active")}
              type="button"
              aria-pressed={selected === role.id}
              onClick={() => setSelected(role.id)}
            >
              <span className="role-card-title">
                <strong>{role.name}</strong>
                {role.isSystem && <small>Hệ thống</small>}
              </span>
              <span>{role.code}</span>
              <small>
                {role.permissions?.length ?? 0} quyền · {role._count?.users ?? 0} người dùng
              </small>
            </button>
          ))}
        </div>
      </section>
      <section className="panel permission-workspace">
        <div className="panel-head wrap">
          <div>
            <h2>Ma trận quyền</h2>
            <p>{selectedRole ? `${selectedRole.name} · ${selectedRole.code}` : "Chưa chọn vai trò"}</p>
          </div>
          <button className="primary-button compact" type="button" disabled={!selectedRole || !hasChanges || saving} onClick={() => void save()}>
            {saving && <Loader2 className="spin" size={15} />}
            Lưu quyền
          </button>
        </div>
        {!selectedRole ? (
          <p className="empty-text">Chọn một vai trò ở danh sách bên trái để bắt đầu cấu hình.</p>
        ) : (
          <>
            <div className="permission-summary">
              <div>
                <strong>{permissionIds.length}</strong>
                <span>quyền đang chọn trên tổng {permissions.data?.length ?? 0}</span>
              </div>
              {hasChanges ? <span className="dirty-note">Có thay đổi chưa lưu</span> : <span className="status-chip">Đã đồng bộ</span>}
            </div>
            <div className="permission-actions">
              <button
                className="ghost-button compact"
                type="button"
                onClick={() => setPermissionIds((permissions.data ?? []).map((permission) => permission.id))}
              >
                Chọn tất cả
              </button>
              <button className="ghost-button compact" type="button" onClick={() => setPermissionIds([])}>
                Bỏ chọn
              </button>
              <button className="ghost-button compact" type="button" disabled={!hasChanges} onClick={resetPermissions}>
                Khôi phục
              </button>
              <label className="copy-role">
                Sao chép từ vai trò
                <select value={copySource} onChange={(event) => setCopySource(event.target.value)}>
                  <option value="">Chọn vai trò nguồn</option>
                  {(data ?? [])
                    .filter((role) => role.id !== selected)
                    .map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                </select>
              </label>
              <button className="ghost-button compact" type="button" disabled={!copySource} onClick={copyPermissionsFromRole}>
                Sao chép
              </button>
            </div>
            {saveError && <p className="form-error">{saveError}</p>}
            <div className="permission-matrix">
              {groupedPermissions.map((group) => {
                const groupIds = group.items.map((permission) => permission.id);
                const checkedCount = groupIds.filter((permissionId) => selectedPermissionSet.has(permissionId)).length;
                const allChecked = groupIds.length > 0 && checkedCount === groupIds.length;
                return (
                  <section className="permission-group" key={group.group}>
                    <div className="permission-group-head">
                      <label className="toggle-line">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          onChange={(event) => setPermissionGroup(groupIds, event.target.checked)}
                        />
                        <strong>{group.label}</strong>
                      </label>
                      <span>
                        {checkedCount}/{groupIds.length}
                      </span>
                    </div>
                    <div className="permission-rows">
                      {group.items.map((permission) => (
                        <label className="permission-row" key={permission.id}>
                          <input
                            type="checkbox"
                            checked={selectedPermissionSet.has(permission.id)}
                            onChange={(event) => setPermission(permission.id, event.target.checked)}
                          />
                          <span>
                            <strong>{permissionActionName(permission.code)}</strong>
                            <small>{permission.code}</small>
                          </span>
                          <em>{permission.description || permission.name}</em>
                        </label>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </section>
    </section>
  );
}

function LogsPage() {
  const { data, loading, error } = useAsyncData(() => api.activityLogs(), []);
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Nhật ký hoạt động</h2>
      </div>
      <DataTable
        columns={["Thời gian", "Người thao tác", "Hành động", "Đối tượng"]}
        rows={(data?.data ?? []).map((log) => ({
          key: log.id,
          cells: [formatDate(log.createdAt), log.actor?.fullName, log.action, `${log.entityType}:${log.entityId ?? ""}`]
        }))}
      />
    </section>
  );
}

function SettingsPage() {
  const { data, loading, error, reload } = useAsyncData(() => api.settings(), []);
  const [form, setForm] = useState({ key: "task.redo.reset_progress", value: "false", description: "" });
  async function submit(event: FormEvent) {
    event.preventDefault();
    await api.saveSetting({ key: form.key, value: form.value === "true" ? true : form.value, description: form.description });
    await reload();
  }
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  return (
    <section className="page-grid">
      <form className="panel form-stack" onSubmit={submit}>
        <div className="panel-head">
          <h2>Cấu hình hệ thống</h2>
        </div>
        <input value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} />
        <input value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} />
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <button className="primary-button" type="submit">
          Lưu cấu hình
        </button>
      </form>
      <section className="panel wide">
        <DataTable
          columns={["Khóa", "Giá trị", "Mô tả"]}
          rows={(data ?? []).map((setting) => ({
            key: setting.id,
            cells: [setting.key, JSON.stringify(setting.value), setting.description]
          }))}
        />
      </section>
    </section>
  );
}

export default function App() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [page, setPage] = useState<Page>("dashboard");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [booting, setBooting] = useState(true);
  const [dark, setDark] = useState(() => localStorage.getItem("workflow.theme") === "dark");
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("workflow.theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    async function bootstrap() {
      const session = getStoredSession();
      if (!session) {
        setBooting(false);
        return;
      }
      try {
        setUser(await api.me());
      } catch {
        setStoredSession(null);
      } finally {
        setBooting(false);
      }
    }
    void bootstrap();
  }, []);

  useEffect(() => {
    if (!user) return;
    api.notifications().then((result) => setUnread(result.unread)).catch(() => setUnread(0));
  }, [user, page]);

  function logout() {
    const session = getStoredSession();
    api.logout(session?.refreshToken).catch(() => undefined);
    setStoredSession(null);
    setUser(null);
  }

  function renderPage() {
    const props = { setPage, setTaskId, setInstanceId };
    switch (page) {
      case "dashboard":
        return <Dashboard {...props} />;
      case "myTasks":
        return <TaskList {...props} mode="mine" />;
      case "tasks":
        return <TaskList {...props} mode="all" />;
      case "kanban":
        return <Kanban {...props} />;
      case "calendar":
        return <CalendarPage {...props} />;
      case "newTask":
        return <TaskForm {...props} />;
      case "taskDetail":
        return <TaskDetail taskId={taskId} setPage={setPage} />;
      case "workflowTemplates":
        return <WorkflowTemplates {...props} />;
      case "workflowBuilder":
        return <WorkflowBuilder {...props} />;
      case "workflowInstances":
        return <WorkflowInstances {...props} />;
      case "newInstance":
        return <NewWorkflowInstance {...props} />;
      case "instanceDetail":
        return <WorkflowInstanceDetail instanceId={instanceId} setPage={setPage} />;
      case "approvals":
        return <WorkflowInstances {...props} pendingMine />;
      case "users":
        return <UsersPage />;
      case "departments":
        return <DepartmentsPage />;
      case "roles":
        return <RolesPage />;
      case "logs":
        return <LogsPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <Dashboard {...props} />;
    }
  }

  if (booting) {
    return <LoadingBlock />;
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <AppShell
      user={user}
      page={page}
      setPage={setPage}
      onLogout={logout}
      unread={unread}
      dark={dark}
      setDark={setDark}
      online={online}
    >
      {renderPage()}
    </AppShell>
  );
}
