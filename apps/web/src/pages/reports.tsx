import { RotateCcw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../api/client";
import { DataTable, ErrorBlock, LoadingBlock } from "../components/common";
import { useAsyncData } from "../hooks/useAsyncData";
import { formatDate, statusLabels } from "../lib/format";
import type { Page } from "../navigation";

interface ReportsPageProps {
  setPage: (page: Page) => void;
  setTaskId: (id: string) => void;
  setInstanceId: (id: string) => void;
}

const emptyReportFilters = {
  departmentId: "",
  taskStatus: "",
  priority: "",
  workflowStatus: "",
  from: "",
  to: ""
};

const taskStatusOptions = ["DRAFT", "TODO", "IN_PROGRESS", "PAUSED", "PENDING_REVIEW", "DONE", "CANCELLED"];
const workflowStatusOptions = ["DRAFT", "SUBMITTED", "IN_PROGRESS", "NEEDS_INFO", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED"];
const priorityLabels: Record<string, string> = {
  LOW: "Thấp",
  NORMAL: "Bình thường",
  HIGH: "Cao",
  URGENT: "Khẩn cấp"
};

function chartWidth(count: number, max: number) {
  if (count <= 0 || max <= 0) return "0%";
  return `${Math.max(6, Math.round((count / max) * 100))}%`;
}

function buildReportQuery(filters: typeof emptyReportFilters) {
  const params = new URLSearchParams();
  if (filters.departmentId) params.set("departmentId", filters.departmentId);
  if (filters.taskStatus) params.set("taskStatus", filters.taskStatus);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.workflowStatus) params.set("workflowStatus", filters.workflowStatus);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const value = params.toString();
  return value ? `?${value}` : "";
}

export function ReportsPage({ setPage, setTaskId, setInstanceId }: ReportsPageProps) {
  const [filters, setFilters] = useState(emptyReportFilters);
  const departments = useAsyncData(() => api.departments(), []);
  const query = useMemo(() => buildReportQuery(filters), [filters]);
  const { data, loading, error } = useAsyncData(() => api.reportsSummary(query), [query]);
  const tasks = data?.tasks ?? {};
  const workflows = data?.workflows ?? {};
  const maxTaskStatus = Math.max(0, ...(tasks.byStatus ?? []).map((item: Record<string, any>) => Number(item._count ?? 0)));
  const maxTaskPriority = Math.max(0, ...(tasks.byPriority ?? []).map((item: Record<string, any>) => Number(item._count ?? 0)));
  const maxWorkflowStatus = Math.max(0, ...(workflows.byStatus ?? []).map((item: Record<string, any>) => Number(item._count ?? 0)));
  const maxWorkflowTemplate = Math.max(0, ...(workflows.byTemplate ?? []).map((item: Record<string, any>) => Number(item.count ?? 0)));
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;

  return (
    <section className="page-grid" data-testid="reports-page">
      <section className="panel wide">
        <div className="panel-head wrap">
          <div>
            <h2>Bộ lọc báo cáo</h2>
            <p>Lọc phía server theo phạm vi dữ liệu người đang đăng nhập được phép xem.</p>
          </div>
          <button className="ghost-button compact" type="button" data-testid="report-filter-reset" onClick={() => setFilters(emptyReportFilters)}>
            <RotateCcw size={15} />
            Đặt lại
          </button>
        </div>
        <div className="filter-grid dashboard-filters" data-testid="report-filter-panel">
          <label>
            Phòng ban
            <select
              value={filters.departmentId}
              data-testid="report-filter-department"
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
            Trạng thái công việc
            <select
              value={filters.taskStatus}
              data-testid="report-filter-task-status"
              onChange={(event) => setFilters((current) => ({ ...current, taskStatus: event.target.value }))}
            >
              <option value="">Tất cả trạng thái</option>
              {taskStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status] ?? status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ưu tiên
            <select
              value={filters.priority}
              data-testid="report-filter-priority"
              onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}
            >
              <option value="">Tất cả mức ưu tiên</option>
              {Object.entries(priorityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Trạng thái hồ sơ
            <select
              value={filters.workflowStatus}
              data-testid="report-filter-workflow-status"
              onChange={(event) => setFilters((current) => ({ ...current, workflowStatus: event.target.value }))}
            >
              <option value="">Tất cả hồ sơ</option>
              {workflowStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status] ?? status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Từ ngày
            <input
              type="date"
              value={filters.from}
              data-testid="report-filter-from"
              onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
            />
          </label>
          <label>
            Đến ngày
            <input
              type="date"
              value={filters.to}
              data-testid="report-filter-to"
              onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
            />
          </label>
        </div>
        <p className="field-hint" data-testid="report-filter-count">
          {activeFilterCount > 0 ? `${activeFilterCount} bộ lọc đang áp dụng.` : "Đang xem toàn bộ dữ liệu trong phạm vi quyền."}
        </p>
      </section>

      <div className="metric-grid">
        <button className="metric-card" type="button" onClick={() => setPage("tasks")}>
          <span>Tổng công việc</span>
          <strong data-testid="report-task-total">{tasks.cards?.total ?? 0}</strong>
        </button>
        <button className="metric-card" type="button" onClick={() => setPage("tasks")}>
          <span>Hoàn thành</span>
          <strong>{tasks.cards?.completed ?? 0}</strong>
        </button>
        <button className="metric-card" type="button" onClick={() => setPage("tasks")}>
          <span>Quá hạn</span>
          <strong>{tasks.cards?.overdue ?? 0}</strong>
        </button>
        <button className="metric-card" type="button" onClick={() => setPage("workflowInstances")}>
          <span>Tổng hồ sơ</span>
          <strong data-testid="report-workflow-total">{workflows.cards?.total ?? 0}</strong>
        </button>
        <button className="metric-card" type="button" onClick={() => setPage("approvals")}>
          <span>Chờ tôi duyệt</span>
          <strong>{workflows.cards?.pendingMine ?? 0}</strong>
        </button>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Công việc theo trạng thái</h2>
        </div>
        <div className="bar-list chart-list" data-testid="report-task-status-chart">
          {(tasks.byStatus ?? []).length === 0 ? (
            <p className="empty-text tight">Chưa có công việc trong bộ lọc này.</p>
          ) : (
            (tasks.byStatus ?? []).map((item: Record<string, any>) => (
              <div className="bar-row" key={item.status}>
                <span>{statusLabels[item.status] ?? item.status}</span>
                <strong>{item._count}</strong>
                <span className="bar-meter" aria-hidden="true">
                  <i style={{ width: chartWidth(Number(item._count ?? 0), maxTaskStatus) }} />
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Công việc theo ưu tiên</h2>
        </div>
        <div className="bar-list chart-list" data-testid="report-task-priority-chart">
          {(tasks.byPriority ?? []).length === 0 ? (
            <p className="empty-text tight">Chưa có công việc trong bộ lọc này.</p>
          ) : (
            (tasks.byPriority ?? []).map((item: Record<string, any>) => (
              <div className="bar-row" key={item.priority}>
                <span>{priorityLabels[item.priority] ?? item.priority}</span>
                <strong>{item._count}</strong>
                <span className="bar-meter" aria-hidden="true">
                  <i style={{ width: chartWidth(Number(item._count ?? 0), maxTaskPriority) }} />
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Hồ sơ theo trạng thái</h2>
        </div>
        <div className="bar-list chart-list" data-testid="report-workflow-status-chart">
          {(workflows.byStatus ?? []).length === 0 ? (
            <p className="empty-text tight">Chưa có hồ sơ trong bộ lọc này.</p>
          ) : (
            (workflows.byStatus ?? []).map((item: Record<string, any>) => (
              <div className="bar-row" key={item.status}>
                <span>{statusLabels[item.status] ?? item.status}</span>
                <strong>{item._count}</strong>
                <span className="bar-meter" aria-hidden="true">
                  <i style={{ width: chartWidth(Number(item._count ?? 0), maxWorkflowStatus) }} />
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Hồ sơ theo mẫu quy trình</h2>
        </div>
        <div className="bar-list chart-list" data-testid="report-workflow-template-chart">
          {(workflows.byTemplate ?? []).length === 0 ? (
            <p className="empty-text tight">Chưa có hồ sơ trong bộ lọc này.</p>
          ) : (
            (workflows.byTemplate ?? []).map((item: Record<string, any>) => (
              <div className="bar-row" key={item.templateId}>
                <span>{item.template?.name ?? "Không rõ mẫu"}</span>
                <strong>{item.count}</strong>
                <span className="bar-meter" aria-hidden="true">
                  <i style={{ width: chartWidth(Number(item.count ?? 0), maxWorkflowTemplate) }} />
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="panel wide">
        <div className="panel-head">
          <h2>Công việc gần nhất trong báo cáo</h2>
        </div>
        <DataTable
          columns={["Mã", "Tên công việc", "Trạng thái", "Ưu tiên", "Phòng ban", "Tiến độ", "Hạn"]}
          rows={(tasks.recent ?? []).map((task: Record<string, any>) => ({
            key: task.id,
            testId: `report-task-row-${task.id}`,
            onClick: () => {
              setTaskId(task.id);
              setPage("taskDetail");
            },
            cells: [
              task.code,
              task.title,
              statusLabels[task.status] ?? task.status,
              priorityLabels[task.priority] ?? task.priority,
              task.department?.name ?? "",
              `${task.progress}%`,
              formatDate(task.dueDate)
            ]
          }))}
        />
      </section>

      <section className="panel wide">
        <div className="panel-head wrap">
          <h2>Hồ sơ gần nhất trong báo cáo</h2>
          <span className="field-hint">
            <Search size={14} /> Nhấn một dòng để mở lịch sử xử lý.
          </span>
        </div>
        <DataTable
          columns={["Mã hồ sơ", "Mẫu quy trình", "Trạng thái", "Người tạo", "Bước hiện tại", "Ngày tạo"]}
          rows={(workflows.recent ?? []).map((instance: Record<string, any>) => ({
            key: instance.id,
            testId: `report-workflow-row-${instance.id}`,
            onClick: () => {
              setInstanceId(instance.id);
              setPage("instanceDetail");
            },
            cells: [
              instance.code,
              instance.template?.name ?? "",
              statusLabels[instance.status] ?? instance.status,
              instance.requester?.fullName ?? "",
              instance.currentStep?.name ?? "",
              formatDate(instance.createdAt)
            ]
          }))}
        />
      </section>
    </section>
  );
}
