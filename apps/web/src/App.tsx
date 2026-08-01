import { lazy, Suspense, useEffect, useState } from "react";
import { api, ApiUser, getStoredSession, setStoredSession } from "./api/client";
import { LoadingBlock } from "./components/common";
import { AppShell } from "./components/layout";
import { Page } from "./navigation";
import { Login } from "./pages/auth";

const Dashboard = lazy(() => import("./pages/dashboard").then((module) => ({ default: module.Dashboard })));
const DepartmentsPage = lazy(() => import("./pages/admin").then((module) => ({ default: module.DepartmentsPage })));
const LogsPage = lazy(() => import("./pages/admin").then((module) => ({ default: module.LogsPage })));
const RolesPage = lazy(() => import("./pages/admin").then((module) => ({ default: module.RolesPage })));
const SettingsPage = lazy(() => import("./pages/admin").then((module) => ({ default: module.SettingsPage })));
const UsersPage = lazy(() => import("./pages/admin").then((module) => ({ default: module.UsersPage })));
const CalendarPage = lazy(() => import("./pages/tasks").then((module) => ({ default: module.CalendarPage })));
const Kanban = lazy(() => import("./pages/tasks").then((module) => ({ default: module.Kanban })));
const TaskDetail = lazy(() => import("./pages/tasks").then((module) => ({ default: module.TaskDetail })));
const TaskForm = lazy(() => import("./pages/tasks").then((module) => ({ default: module.TaskForm })));
const TaskList = lazy(() => import("./pages/tasks").then((module) => ({ default: module.TaskList })));
const NewWorkflowInstance = lazy(() => import("./pages/workflows").then((module) => ({ default: module.NewWorkflowInstance })));
const WorkflowBuilder = lazy(() => import("./pages/workflows").then((module) => ({ default: module.WorkflowBuilder })));
const WorkflowInstanceDetail = lazy(() => import("./pages/workflows").then((module) => ({ default: module.WorkflowInstanceDetail })));
const WorkflowInstances = lazy(() => import("./pages/workflows").then((module) => ({ default: module.WorkflowInstances })));
const WorkflowTemplates = lazy(() => import("./pages/workflows").then((module) => ({ default: module.WorkflowTemplates })));
const ProfilePage = lazy(() => import("./pages/profile").then((module) => ({ default: module.ProfilePage })));
const NotificationsPage = lazy(() => import("./pages/notifications").then((module) => ({ default: module.NotificationsPage })));

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
      case "notifications":
        return <NotificationsPage {...props} onUnreadChanged={setUnread} />;
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
      case "profile":
        return (
          <ProfilePage
            onPasswordChanged={logout}
            onProfileUpdated={(profile) =>
              setUser((current) =>
                current
                  ? {
                      ...current,
                      fullName: profile.fullName ?? current.fullName,
                      title: profile.title ?? current.title,
                      avatarUrl: profile.avatarUrl ?? current.avatarUrl,
                      department: profile.department ?? current.department
                    }
                  : current
              )
            }
          />
        );
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
      setTaskId={setTaskId}
      setInstanceId={setInstanceId}
      onLogout={logout}
      unread={unread}
      dark={dark}
      setDark={setDark}
      online={online}
    >
      <Suspense fallback={<LoadingBlock />}>{renderPage()}</Suspense>
    </AppShell>
  );
}
