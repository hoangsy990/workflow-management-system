import { CheckCheck, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { api } from "../api/client";
import { ErrorBlock, LoadingBlock } from "../components/common";
import { useAsyncData } from "../hooks/useAsyncData";
import { cls, formatDate } from "../lib/format";
import { Page } from "../navigation";

interface NotificationsPageProps {
  setPage: (page: Page) => void;
  setTaskId: (id: string) => void;
  setInstanceId: (id: string) => void;
  onUnreadChanged: (value: number) => void;
}

function resolveNotificationTarget(item: Record<string, any>) {
  const link = String(item.link ?? "");
  if (link.startsWith("/tasks/")) {
    return { page: "taskDetail" as const, id: link.split("/").filter(Boolean).at(-1) };
  }
  if (link.startsWith("/workflows/instances/")) {
    return { page: "instanceDetail" as const, id: link.split("/").filter(Boolean).at(-1) };
  }
  return null;
}

export function NotificationsPage({ setPage, setTaskId, setInstanceId, onUnreadChanged }: NotificationsPageProps) {
  const { data, loading, error, reload } = useAsyncData(() => api.notifications(50), []);
  const [busyId, setBusyId] = useState("");
  const [readAllLoading, setReadAllLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const items = data?.data ?? [];

  async function markRead(item: Record<string, any>) {
    if (item.readAt) return;
    setBusyId(item.id);
    setLocalError("");
    try {
      await api.readNotification(item.id);
      onUnreadChanged(Math.max(0, (data?.unread ?? 0) - 1));
      await reload();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Không đánh dấu đã đọc được thông báo.");
    } finally {
      setBusyId("");
    }
  }

  async function openNotification(item: Record<string, any>) {
    await markRead(item);
    const target = resolveNotificationTarget(item);
    if (!target?.id) return;
    if (target.page === "taskDetail") {
      setTaskId(target.id);
      setPage("taskDetail");
    } else {
      setInstanceId(target.id);
      setPage("instanceDetail");
    }
  }

  async function markAllRead() {
    setReadAllLoading(true);
    setLocalError("");
    try {
      await api.readAllNotifications();
      onUnreadChanged(0);
      await reload();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Không đánh dấu đã đọc tất cả thông báo.");
    } finally {
      setReadAllLoading(false);
    }
  }

  return (
    <section className="panel wide notifications-page" data-testid="notifications-page">
      <div className="panel-head wrap">
        <div>
          <h2>Thông báo</h2>
          <p>{data?.unread ?? 0} thông báo chưa đọc</p>
        </div>
        <div className="inline-actions">
          <button className="ghost-button compact" type="button" disabled={loading} onClick={reload}>
            <RefreshCcw size={16} />
            Làm mới
          </button>
          <button className="primary-button compact" type="button" disabled={readAllLoading || (data?.unread ?? 0) === 0} onClick={markAllRead}>
            <CheckCheck size={16} />
            {readAllLoading ? "Đang xử lý" : "Đã đọc tất cả"}
          </button>
        </div>
      </div>

      {error && <ErrorBlock message={error} />}
      {localError && <p className="form-error" role="alert">{localError}</p>}
      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="notification-list">
          {items.length === 0 && <p className="empty-text">Chưa có thông báo.</p>}
          {items.map((item: Record<string, any>) => (
            <button
              key={item.id}
              className={cls("notification-item", !item.readAt && "unread")}
              data-testid={`notification-row-${item.id}`}
              type="button"
              disabled={busyId === item.id}
              onClick={() => openNotification(item)}
            >
              <span className="notification-main">
                <strong>{item.title}</strong>
                <span>{item.content}</span>
              </span>
              <span className="notification-meta">
                <small>{item.type}</small>
                <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
