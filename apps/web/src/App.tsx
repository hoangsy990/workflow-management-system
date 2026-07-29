import {
  Activity,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Columns3,
  FileClock,
  Home,
  Loader2,
  LogOut,
  Menu,
  Moon,
  Settings,
  ShieldCheck,
  Smartphone,
  Sun,
  Users,
  Workflow,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, ApiUser, getStoredSession, setStoredSession } from "./api/client";
import { DataTable, ErrorBlock, LoadingBlock } from "./components/common";
import { useAsyncData } from "./hooks/useAsyncData";
import { CalendarPage, Kanban, TaskDetail, TaskForm, TaskList } from "./pages/tasks";
import { NewWorkflowInstance, WorkflowBuilder, WorkflowInstanceDetail, WorkflowInstances, WorkflowTemplates } from "./pages/workflows";
import { DepartmentsPage, LogsPage, RolesPage, SettingsPage, UsersPage } from "./pages/admin";

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

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh"
  }).format(new Date(value));
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
            <input
              data-testid="login-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
            />
          </label>
          <label>
            Mật khẩu
            <input
              data-testid="login-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" data-testid="login-submit" type="submit" disabled={loading}>
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
                data-testid={`nav-${item.page}`}
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
                  data-testid={`mobile-menu-${item.page}`}
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
              data-testid={`bottom-nav-${item.page}`}
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
