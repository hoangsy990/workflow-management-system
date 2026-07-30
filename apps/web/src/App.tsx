import { useEffect, useState } from "react";
import { api, ApiUser, getStoredSession, setStoredSession } from "./api/client";
import { LoadingBlock } from "./components/common";
import { AppShell } from "./components/layout";
import { Page } from "./navigation";
import { Login } from "./pages/auth";
import { Dashboard } from "./pages/dashboard";
import { DepartmentsPage, LogsPage, RolesPage, SettingsPage, UsersPage } from "./pages/admin";
import { CalendarPage, Kanban, TaskDetail, TaskForm, TaskList } from "./pages/tasks";
import { NewWorkflowInstance, WorkflowBuilder, WorkflowInstanceDetail, WorkflowInstances, WorkflowTemplates } from "./pages/workflows";
import { ProfilePage } from "./pages/profile";

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
      case "profile":
        return (
          <ProfilePage
            onProfileUpdated={(profile) =>
              setUser((current) =>
                current
                  ? {
                      ...current,
                      fullName: profile.fullName,
                      title: profile.title,
                      department: profile.department
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
