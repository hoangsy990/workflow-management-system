import { useMemo, useState } from "react";
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

const emptyDashboardFilters = {
  departmentId: "",
  from: "",
  to: ""
};

function chartWidth(count: number, max: number) {
  if (count <= 0 || max <= 0) return "0%";
  return `${Math.max(6, Math.round((count / max) * 100))}%`;
}

export function Dashboard({ setPage, setTaskId, setInstanceId }: DashboardProps) {
  const [filters, setFilters] = useState(emptyDashboardFilters);
  const departments = useAsyncData(() => api.departments(), []);
  const dashboardQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.departmentId) params.set("departmentId", filters.departmentId);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    const value = params.toString();
    return value ? `?${value}` : "";
  }, [filters.departmentId, filters.from, filters.to]);
  const { data, loading, error } = useAsyncData(() => api.dashboard(dashboardQuery), [dashboardQuery]);
  const notifications = useAsyncData(() => api.notifications(), []);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;

  const cards = data?.cards ?? {};
  const statusStats = data?.tasksByStatus ?? [];
  const departmentStats = data?.tasksByDepartment ?? [];
  const maxStatusCount = Math.max(0, ...statusStats.map((item: Record<string, any>) => Number(item._count ?? 0)));
  const maxDepartmentCount = Math.max(
    0,
    ...departmentStats.map((item: Record<string, any>) => Number(item.count ?? item._count ?? 0))
  );
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
      <section className="panel wide">
        <div className="panel-head wrap">
          <h2>Bộ lọc dashboard</h2>
          <button
            className="ghost-button compact"
            type="button"
            data-testid="dashboard-filter-reset"
            onClick={() => setFilters(emptyDashboardFilters)}
          >
            Đặt lại
          </button>
        </div>
        <div className="filter-grid dashboard-filters">
          <label>
            Phòng ban
            <select
              value={filters.departmentId}
              data-testid="dashboard-filter-department"
              onChange={(event) => setFilters((current) => ({ ...current, departmentId: event.target.value }))}
              disabled={departments.loading}
            >
              <option value="">Tất cả phòng ban</option>
              {(departments.data ?? []).map((department: Record<string, any>) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Từ ngày
            <input
              type="date"
              value={filters.from}
              data-testid="dashboard-filter-from"
              onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
            />
          </label>
          <label>
            Đến ngày
            <input
              type="date"
              value={filters.to}
              data-testid="dashboard-filter-to"
              onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
            />
          </label>
        </div>
      </section>

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
        <div className="bar-list chart-list" data-testid="dashboard-status-chart">
          {statusStats.length === 0 ? (
            <p className="empty-text tight">Chưa có công việc trong bộ lọc hiện tại.</p>
          ) : (
            statusStats.map((item: Record<string, any>) => (
              <div key={item.status} className="bar-row">
                <span>{statusLabels[item.status] ?? item.status}</span>
                <strong>{item._count}</strong>
                <span className="bar-meter" aria-hidden="true">
                  <i style={{ width: chartWidth(Number(item._count ?? 0), maxStatusCount) }} />
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Thống kê phòng ban</h2>
        </div>
        <div className="bar-list chart-list" data-testid="dashboard-department-stats">
          {departmentStats.length === 0 ? (
            <p className="empty-text tight">Chưa có công việc theo phòng ban trong bộ lọc hiện tại.</p>
          ) : (
            departmentStats.map((item: Record<string, any>) => {
              const count = Number(item.count ?? item._count ?? 0);
              return (
                <div key={item.departmentId ?? "none"} className="bar-row">
                  <span>{item.department?.name ?? "Chưa có phòng ban"}</span>
                  <strong>{count}</strong>
                  <span className="bar-meter" aria-hidden="true">
                    <i style={{ width: chartWidth(count, maxDepartmentCount) }} />
                  </span>
                </div>
              );
            })
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
        <div className="panel-head wrap">
          <h2>Thông báo</h2>
          <button className="ghost-button compact" type="button" onClick={() => setPage("notifications")}>
            Xem tất cả
          </button>
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
