import { api } from "../api/client";
import { DataTable, ErrorBlock, LoadingBlock } from "../components/common";
import { formatDate, statusLabels } from "../lib/format";
import { Page } from "../navigation";
import { useAsyncData } from "../hooks/useAsyncData";

interface DashboardProps {
  setPage: (page: Page) => void;
  setTaskId: (id: string) => void;
  setInstanceId: (id: string) => void;
}

export function Dashboard({ setPage, setTaskId, setInstanceId }: DashboardProps) {
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
          <h2>Thống kê phòng ban</h2>
        </div>
        <div className="bar-list" data-testid="dashboard-department-stats">
          {(data?.tasksByDepartment ?? []).length === 0 ? (
            <p className="empty-text tight">Chưa có công việc theo phòng ban.</p>
          ) : (
            (data?.tasksByDepartment ?? []).map((item: Record<string, any>) => (
              <div key={item.departmentId ?? "none"}>
                <span>{item.department?.name ?? "Chưa có phòng ban"}</span>
                <strong>{item.count ?? item._count ?? 0}</strong>
              </div>
            ))
          )}
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
