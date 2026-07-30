import { Download, Loader2, Plus, RotateCcw, Search, SlidersHorizontal, Star, Upload, XCircle } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { DataTable, ErrorBlock, LoadingBlock, MultiCheck } from "../components/common";
import { useAsyncData } from "../hooks/useAsyncData";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { cls, formatDate, statusLabels } from "../lib/format";

type TaskPage = "tasks" | "newTask" | "taskDetail";
type TaskEvaluationMode = "accept" | "redo";
type MyTaskView = "assignee" | "assigner" | "manager" | "follower" | "review" | "overdue" | "done";
type TaskFilters = {
  code: string;
  creatorId: string;
  assigneeId: string;
  managerId: string;
  departmentId: string;
  priority: string;
  categoryId: string;
  tagId: string;
  from: string;
  to: string;
  overdue: boolean;
};

interface TaskPageProps {
  setPage: (page: TaskPage) => void;
  setTaskId: (id: string) => void;
}

const priorityLabels: Record<string, string> = {
  LOW: "Thấp",
  NORMAL: "Bình thường",
  HIGH: "Cao",
  URGENT: "Khẩn cấp"
};
const myTaskTabs: Array<{ key: MyTaskView; label: string; lockedStatus?: string }> = [
  { key: "assignee", label: "Tôi thực hiện" },
  { key: "assigner", label: "Tôi giao" },
  { key: "manager", label: "Tôi quản lý" },
  { key: "follower", label: "Tôi theo dõi" },
  { key: "review", label: "Chờ tôi đánh giá", lockedStatus: "PENDING_REVIEW" },
  { key: "overdue", label: "Đã quá hạn" },
  { key: "done", label: "Đã hoàn thành", lockedStatus: "DONE" }
];
const defaultTaskFilters: TaskFilters = {
  code: "",
  creatorId: "",
  assigneeId: "",
  managerId: "",
  departmentId: "",
  priority: "",
  categoryId: "",
  tagId: "",
  from: "",
  to: "",
  overdue: false
};
const taskListPageSize = 10;
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

function formatFileSize(bytes?: number) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function collectAllowedAttachmentFiles(files: FileList | null) {
  const accepted: File[] = [];
  let error = "";
  if (!files) return { accepted, error };

  for (const file of Array.from(files)) {
    if (!allowedAttachmentTypes.has(file.type)) {
      error = `Tệp ${file.name} không đúng định dạng cho phép.`;
      continue;
    }
    if (file.size > maxAttachmentMb * 1024 * 1024) {
      error = `Tệp ${file.name} vượt quá ${maxAttachmentMb} MB.`;
      continue;
    }
    accepted.push(file);
  }

  return { accepted, error };
}

function toLocalDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function calendarDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const offset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - offset);
  return result;
}

function endOfWeek(date: Date) {
  return addDays(startOfWeek(date), 6);
}

function buildCalendarDays(tasks: Record<string, any>[]) {
  const today = toLocalDate(new Date().toISOString()) ?? new Date();
  let min = today;
  let max = addDays(today, 13);

  for (const task of tasks) {
    const start = toLocalDate(task.startDate);
    const due = toLocalDate(task.dueDate);
    for (const date of [start, due]) {
      if (!date) continue;
      if (date < min) min = date;
      if (date > max) max = date;
    }
  }

  const days: Date[] = [];
  for (let current = startOfWeek(min); current <= endOfWeek(max); current = addDays(current, 1)) {
    days.push(current);
  }
  return days;
}

export function TaskList({ mode, setPage, setTaskId }: TaskPageProps & { mode: "all" | "mine" }) {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [myTaskView, setMyTaskView] = useState<MyTaskView>("assignee");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>(defaultTaskFilters);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState("dueDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [listActionError, setListActionError] = useState("");
  const [listActionMessage, setListActionMessage] = useState("");
  const users = useAsyncData(() => api.users(), []);
  const departments = useAsyncData(() => api.departments(), []);
  const categories = useAsyncData(() => api.taskCategories(), []);
  const tags = useAsyncData(() => api.tags(), []);
  const lockedStatus = mode === "mine" ? myTaskTabs.find((tab) => tab.key === myTaskView)?.lockedStatus : undefined;
  const debouncedKeyword = useDebouncedValue(keyword.trim(), 350);
  const debouncedCode = useDebouncedValue(filters.code.trim(), 350);
  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(currentPage), pageSize: String(taskListPageSize) });
    if (debouncedKeyword) params.set("keyword", debouncedKeyword);
    if (status && !lockedStatus) params.set("status", status);
    if (debouncedCode) params.set("code", debouncedCode);
    if (filters.creatorId) params.set("creatorId", filters.creatorId);
    if (filters.assigneeId) params.set("assigneeId", filters.assigneeId);
    if (filters.managerId) params.set("managerId", filters.managerId);
    if (filters.departmentId) params.set("departmentId", filters.departmentId);
    if (filters.priority) params.set("priority", filters.priority);
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.tagId) params.set("tagId", filters.tagId);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.overdue) params.set("overdue", "true");
    if (sortBy) params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);
    if (mode === "mine") params.set("myView", myTaskView);
    return `?${params.toString()}`;
  }, [
    currentPage,
    debouncedKeyword,
    status,
    lockedStatus,
    debouncedCode,
    filters.creatorId,
    filters.assigneeId,
    filters.managerId,
    filters.departmentId,
    filters.priority,
    filters.categoryId,
    filters.tagId,
    filters.from,
    filters.to,
    filters.overdue,
    sortBy,
    sortOrder,
    mode,
    myTaskView
  ]);
  const { data, loading, error, reload } = useAsyncData(() => api.tasks(query), [query]);
  const pagination = data?.pagination;
  const userOptions = users.data?.data ?? [];
  const departmentOptions = departments.data ?? [];
  const categoryOptions = categories.data ?? [];
  const tagOptions = tags.data ?? [];
  const startableStatuses = new Set(["DRAFT", "TODO", "PAUSED"]);

  function openTask(task: Record<string, any>) {
    setTaskId(task.id);
    setPage("taskDetail");
  }

  async function startTask(task: Record<string, any>, event: { stopPropagation: () => void }) {
    event.stopPropagation();
    setStatusUpdatingId(task.id);
    setListActionError("");
    setListActionMessage("");
    try {
      await api.updateTask(task.id, { status: "IN_PROGRESS" });
      setListActionMessage(`Đã chuyển ${task.code} sang Đang thực hiện.`);
      await reload();
    } catch (err) {
      setListActionError(err instanceof Error ? err.message : "Không cập nhật được trạng thái công việc.");
    } finally {
      setStatusUpdatingId(null);
    }
  }

  const tableRows =
    data?.data?.map((task) => ({
      key: task.id,
      testId: `task-row-${task.id}`,
      onClick: () => openTask(task),
      cells: [
        task.code,
        task.title,
        <span className={cls("status-chip", task.displayStatus)}>{statusLabels[task.displayStatus ?? task.status]}</span>,
        `${task.progress}%`,
        task.assignees?.map((item: Record<string, any>) => item.user.fullName).join(", ") ?? "",
        task.assigner?.fullName ?? "",
        task.department?.name ?? "",
        priorityLabels[task.priority] ?? task.priority,
        formatDate(task.startDate),
        formatDate(task.dueDate),
        task.isOverdue ? `Quá hạn ${Math.abs(task.daysRemaining ?? 0)} ngày` : `${task.daysRemaining ?? 0} ngày`,
        <div className="row-actions">
          <button
            className="ghost-button compact"
            data-testid={`task-row-open-${task.id}`}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openTask(task);
            }}
          >
            Mở
          </button>
          <button
            className="primary-button compact"
            data-testid={`task-row-start-${task.id}`}
            type="button"
            disabled={!startableStatuses.has(task.status) || statusUpdatingId === task.id}
            title={startableStatuses.has(task.status) ? "Chuyển sang Đang thực hiện" : "Chỉ áp dụng cho Bản nháp/Chưa thực hiện/Tạm dừng"}
            onClick={(event) => void startTask(task, event)}
          >
            {statusUpdatingId === task.id && <Loader2 className="spin" size={14} />}
            {task.status === "PAUSED" ? "Tiếp tục" : "Bắt đầu"}
          </button>
        </div>
      ]
    })) ?? [];

  useEffect(() => {
    setCurrentPage(1);
  }, [
    debouncedKeyword,
    status,
    debouncedCode,
    filters.creatorId,
    filters.assigneeId,
    filters.managerId,
    filters.departmentId,
    filters.priority,
    filters.categoryId,
    filters.tagId,
    filters.from,
    filters.to,
    filters.overdue,
    sortBy,
    sortOrder,
    mode,
    myTaskView
  ]);

  useEffect(() => {
    if (pagination && currentPage > pagination.totalPages) {
      setCurrentPage(pagination.totalPages);
    }
  }, [currentPage, pagination]);

  function selectMyTaskView(nextView: MyTaskView) {
    setMyTaskView(nextView);
    if (myTaskTabs.find((tab) => tab.key === nextView)?.lockedStatus) {
      setStatus("");
    }
  }

  function updateFilter<Key extends keyof TaskFilters>(key: Key, value: TaskFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setKeyword("");
    setStatus("");
    setFilters(defaultTaskFilters);
    setSortBy("dueDate");
    setSortOrder("asc");
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;

  return (
    <section className="panel">
      <div className="panel-head wrap">
        <h2>{mode === "mine" ? "Công việc của tôi" : "Danh sách công việc"}</h2>
        <div className="toolbar">
          <label className="search-box">
            <Search size={16} />
            <input
              data-testid="task-search-input"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm kiếm"
            />
          </label>
          <select
            value={lockedStatus ?? status}
            onChange={(event) => setStatus(event.target.value)}
            disabled={Boolean(lockedStatus)}
            title={lockedStatus ? "Tab này tự lọc trạng thái phù hợp" : undefined}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(statusLabels)
              .filter(([key]) => ["DRAFT", "TODO", "IN_PROGRESS", "PAUSED", "PENDING_REVIEW", "DONE", "CANCELLED"].includes(key))
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </select>
          <label className="toolbar-select">
            Sắp xếp
            <select data-testid="task-sort-by" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="dueDate">Hạn hoàn thành</option>
              <option value="startDate">Ngày bắt đầu</option>
              <option value="createdAt">Ngày tạo</option>
              <option value="priority">Ưu tiên</option>
              <option value="status">Trạng thái</option>
              <option value="progress">Tiến độ</option>
              <option value="code">Mã</option>
              <option value="title">Tên công việc</option>
            </select>
          </label>
          <label className="toolbar-select compact-sort">
            Chiều
            <select data-testid="task-sort-order" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as "asc" | "desc")}>
              <option value="asc">Tăng</option>
              <option value="desc">Giảm</option>
            </select>
          </label>
          <button
            className="ghost-button compact"
            data-testid="task-filter-toggle"
            type="button"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((current) => !current)}
          >
            <SlidersHorizontal size={16} />
            Bộ lọc
          </button>
          <button className="primary-button compact" data-testid="task-create-open" type="button" onClick={() => setPage("newTask")}>
            <Plus size={16} />
            Tạo công việc
          </button>
          <button className="ghost-button compact" type="button" onClick={() => void reload()}>
            Làm mới
          </button>
        </div>
      </div>
      {mode === "mine" && (
        <div className="view-tabs" role="tablist" aria-label="Công việc của tôi">
          {myTaskTabs.map((tab) => (
            <button
              key={tab.key}
              className={cls("tab-button", tab.key === myTaskView && "active")}
              data-testid={`my-task-tab-${tab.key}`}
              type="button"
              role="tab"
              aria-selected={tab.key === myTaskView}
              onClick={() => selectMyTaskView(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
      {filtersOpen && (
        <div className="filter-panel" data-testid="task-filter-panel">
          <div className="filter-grid">
            <label>
              Mã công việc
              <input
                data-testid="task-filter-code"
                value={filters.code}
                onChange={(event) => updateFilter("code", event.target.value)}
                placeholder="TASK-..."
              />
            </label>
            <label>
              Người tạo
              <select
                data-testid="task-filter-creator"
                value={filters.creatorId}
                onChange={(event) => updateFilter("creatorId", event.target.value)}
              >
                <option value="">Tất cả</option>
                {userOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Người thực hiện
              <select
                data-testid="task-filter-assignee"
                value={filters.assigneeId}
                onChange={(event) => updateFilter("assigneeId", event.target.value)}
              >
                <option value="">Tất cả</option>
                {userOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Người quản lý
              <select
                data-testid="task-filter-manager"
                value={filters.managerId}
                onChange={(event) => updateFilter("managerId", event.target.value)}
              >
                <option value="">Tất cả</option>
                {userOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Phòng ban
              <select
                data-testid="task-filter-department"
                value={filters.departmentId}
                onChange={(event) => updateFilter("departmentId", event.target.value)}
              >
                <option value="">Tất cả</option>
                {departmentOptions.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mức ưu tiên
              <select
                data-testid="task-filter-priority"
                value={filters.priority}
                onChange={(event) => updateFilter("priority", event.target.value)}
              >
                <option value="">Tất cả</option>
                {Object.entries(priorityLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Danh mục
              <select
                data-testid="task-filter-category"
                value={filters.categoryId}
                onChange={(event) => updateFilter("categoryId", event.target.value)}
              >
                <option value="">Tất cả</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nhãn
              <select data-testid="task-filter-tag" value={filters.tagId} onChange={(event) => updateFilter("tagId", event.target.value)}>
                <option value="">Tất cả</option>
                {tagOptions.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Hạn từ ngày
              <input data-testid="task-filter-from" type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} />
            </label>
            <label>
              Hạn đến ngày
              <input data-testid="task-filter-to" type="date" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} />
            </label>
            <label className="toggle-line">
              <input
                data-testid="task-filter-overdue"
                type="checkbox"
                checked={filters.overdue}
                onChange={(event) => updateFilter("overdue", event.target.checked)}
              />
              Công việc quá hạn
            </label>
          </div>
          <div className="form-actions">
            <button className="ghost-button compact" data-testid="task-filter-reset" type="button" onClick={resetFilters}>
              <RotateCcw size={16} />
              Xóa lọc
            </button>
          </div>
        </div>
      )}
      <DataTable
        columns={[
          "Mã",
          "Tên công việc",
          "Trạng thái",
          "Tiến độ",
          "Người thực hiện",
          "Người giao",
          "Phòng ban",
          "Ưu tiên",
          "Ngày bắt đầu",
          "Hạn hoàn thành",
          "Còn/quá hạn",
          "Thao tác"
        ]}
        rows={tableRows}
      />
      {listActionError && <p className="form-error">{listActionError}</p>}
      {listActionMessage && <p className="success-text" data-testid="task-list-action-message">{listActionMessage}</p>}
      {pagination && (
        <div className="pagination-bar" data-testid="task-pagination">
          <button
            className="ghost-button compact"
            data-testid="task-pagination-prev"
            type="button"
            disabled={loading || pagination.page <= 1}
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
          >
            Trước
          </button>
          <span data-testid="task-pagination-summary">
            Trang {pagination.page}/{pagination.totalPages} - {pagination.total} công việc
          </span>
          <button
            className="ghost-button compact"
            data-testid="task-pagination-next"
            type="button"
            disabled={loading || pagination.page >= pagination.totalPages}
            onClick={() => setCurrentPage((page) => page + 1)}
          >
            Sau
          </button>
        </div>
      )}
    </section>
  );
}

export function Kanban({ setPage, setTaskId }: TaskPageProps) {
  const { data, loading, error, reload } = useAsyncData(() => api.tasks("?pageSize=100"), []);
  const statuses = ["TODO", "IN_PROGRESS", "PAUSED", "PENDING_REVIEW", "DONE", "CANCELLED"];
  const [pendingMove, setPendingMove] = useState<{ task: Record<string, any>; status: string } | null>(null);
  const [kanbanBusy, setKanbanBusy] = useState(false);
  const [kanbanError, setKanbanError] = useState("");
  const [kanbanMessage, setKanbanMessage] = useState("");

  async function moveTask(task: Record<string, any>, status: string) {
    if (!task?.id || task.status === status) return;
    setKanbanBusy(true);
    setKanbanError("");
    setKanbanMessage("");
    try {
      await api.updateTask(task.id, { status });
      await reload();
      setKanbanMessage(`Đã chuyển ${task.code} sang ${statusLabels[status] ?? status}.`);
    } catch (err) {
      setKanbanError(err instanceof Error ? err.message : "Không chuyển được trạng thái công việc.");
    } finally {
      setKanbanBusy(false);
      setPendingMove(null);
    }
  }

  function requestMove(taskId: string, status: string) {
    const task = (data?.data ?? []).find((item) => item.id === taskId);
    if (!task || task.status === status) return;
    if (["PENDING_REVIEW", "DONE", "CANCELLED"].includes(status)) {
      setPendingMove({ task, status });
      setKanbanError("");
      setKanbanMessage("");
      return;
    }
    void moveTask(task, status);
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;

  return (
    <section className="kanban-wrap">
      {pendingMove && (
        <div className="kanban-confirm" data-testid="kanban-confirm-panel">
          <div>
            <strong>Xác nhận chuyển trạng thái</strong>
            <p>
              {pendingMove.task.code} - {pendingMove.task.title} sang {statusLabels[pendingMove.status] ?? pendingMove.status}
            </p>
          </div>
          <div className="form-actions">
            <button className="ghost-button compact" data-testid="kanban-confirm-cancel" type="button" disabled={kanbanBusy} onClick={() => setPendingMove(null)}>
              Hủy
            </button>
            <button className="primary-button compact" data-testid="kanban-confirm-submit" type="button" disabled={kanbanBusy} onClick={() => void moveTask(pendingMove.task, pendingMove.status)}>
              {kanbanBusy && <Loader2 className="spin" size={16} />}
              Xác nhận
            </button>
          </div>
        </div>
      )}
      {kanbanError && <p className="form-error" data-testid="kanban-error">{kanbanError}</p>}
      {kanbanMessage && <p className="success-text" data-testid="kanban-message">{kanbanMessage}</p>}
      <div className="kanban">
        {statuses.map((status) => (
          <section
            key={status}
            className="kanban-column"
            data-testid={`kanban-column-${status}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => requestMove(event.dataTransfer.getData("taskId"), status)}
          >
            <h3>{statusLabels[status]}</h3>
            {(data?.data ?? [])
              .filter((task) => task.status === status)
              .map((task) => (
                <button
                  key={task.id}
                  className="kanban-card"
                  data-testid={`kanban-card-${task.id}`}
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
    </section>
  );
}

export function CalendarPage({ setPage, setTaskId }: TaskPageProps) {
  const calendarQuery = useMemo(() => {
    const params = new URLSearchParams({ pageSize: "100" });
    params.set("from", addDays(new Date(), -30).toISOString());
    params.set("to", addDays(new Date(), 90).toISOString());
    return `?${params.toString()}`;
  }, []);
  const { data, loading, error } = useAsyncData(() => api.tasks(calendarQuery), [calendarQuery]);
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  const tasks = data?.data ?? [];
  const days = buildCalendarDays(tasks);
  const tasksByStart = new Map<string, Record<string, any>[]>();
  const tasksByDue = new Map<string, Record<string, any>[]>();
  for (const task of tasks) {
    const start = toLocalDate(task.startDate);
    const due = toLocalDate(task.dueDate);
    if (start) {
      const key = calendarDateKey(start);
      tasksByStart.set(key, [...(tasksByStart.get(key) ?? []), task]);
    }
    if (due) {
      const key = calendarDateKey(due);
      tasksByDue.set(key, [...(tasksByDue.get(key) ?? []), task]);
    }
  }
  const openTask = (task: Record<string, any>) => {
    setTaskId(task.id);
    setPage("taskDetail");
  };

  return (
    <section className="calendar-board" data-testid="task-calendar-board">
      {days.map((day) => {
        const key = calendarDateKey(day);
        const starts = tasksByStart.get(key) ?? [];
        const dues = tasksByDue.get(key) ?? [];
        return (
          <div className="calendar-day" data-testid={`task-calendar-day-${key}`} key={key}>
            <div className="calendar-date">
              <strong>{formatDate(day.toISOString())}</strong>
              <span>{day.toLocaleDateString("vi-VN", { weekday: "short" })}</span>
            </div>
            <div className="calendar-events">
              {starts.map((task) => (
                <button
                  className="calendar-event start"
                  data-testid={`task-calendar-start-${task.id}`}
                  key={`start-${task.id}`}
                  type="button"
                  onClick={() => openTask(task)}
                >
                  <small>Bắt đầu</small>
                  <strong>{task.title}</strong>
                  <span>{task.code}</span>
                </button>
              ))}
              {dues.map((task) => (
                <button
                  className="calendar-event due"
                  data-testid={`task-calendar-due-${task.id}`}
                  key={`due-${task.id}`}
                  type="button"
                  onClick={() => openTask(task)}
                >
                  <small>Hạn</small>
                  <strong>{task.title}</strong>
                  <span>{statusLabels[task.displayStatus ?? task.status]}</span>
                </button>
              ))}
              {starts.length === 0 && dues.length === 0 && <span className="empty-text tight">Không có việc</span>}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function TaskForm({ setPage, setTaskId }: TaskPageProps) {
  const users = useAsyncData(() => api.users(), []);
  const departments = useAsyncData(() => api.departments(), []);
  const categories = useAsyncData(() => api.taskCategories(), []);
  const tags = useAsyncData(() => api.tags(), []);
  const [taskLinkKeyword, setTaskLinkKeyword] = useState("");
  const taskLinkQuery = useMemo(() => {
    const params = new URLSearchParams({ pageSize: "100" });
    if (taskLinkKeyword.trim()) params.set("keyword", taskLinkKeyword.trim());
    return `?${params.toString()}`;
  }, [taskLinkKeyword]);
  const taskOptions = useAsyncData(() => api.tasks(taskLinkQuery), [taskLinkQuery]);
  const draftKey = "workflow.task.draft";
  const initial = useMemo(() => {
    const stored = localStorage.getItem(draftKey);
    return stored ? JSON.parse(stored) : {};
  }, []);
  const [form, setForm] = useState<Record<string, any>>({
    title: initial.title ?? "",
    description: initial.description ?? "",
    assignerId: initial.assignerId ?? "",
    assigneeIds: initial.assigneeIds ?? [],
    followerIds: initial.followerIds ?? [],
    managerId: initial.managerId ?? "",
    departmentId: initial.departmentId ?? "",
    parentTaskId: initial.parentTaskId ?? "",
    relatedTaskIds: initial.relatedTaskIds ?? [],
    priority: initial.priority ?? "NORMAL",
    startDate: initial.startDate ?? "",
    dueDate: initial.dueDate ?? "",
    categoryId: initial.categoryId ?? "",
    tagIds: initial.tagIds ?? [],
    requiresReview: initial.requiresReview ?? true,
    autoCalculateParentProgress: initial.autoCalculateParentProgress ?? false
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const taskLinkItems = useMemo<Array<Record<string, any> & { name: string }>>(
    () => (taskOptions.data?.data ?? []).map((task: Record<string, any>) => ({ ...task, name: `${task.code} - ${task.title}` })),
    [taskOptions.data]
  );

  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify(form));
  }, [form]);

  function update(key: string, value: unknown) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addFiles(files: FileList | null) {
    const result = collectAllowedAttachmentFiles(files);
    setError(result.error);
    setSelectedFiles((current) => [...current, ...result.accepted]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const task = await api.createTask({
        ...form,
        assignerId: form.assignerId || undefined,
        managerId: form.managerId || undefined,
        departmentId: form.departmentId || undefined,
        parentTaskId: form.parentTaskId || undefined,
        relatedTaskIds: form.relatedTaskIds ?? [],
        categoryId: form.categoryId || undefined,
        startDate: form.startDate || undefined,
        dueDate: form.dueDate || undefined
      });
      for (const file of selectedFiles) {
        await api.uploadTaskAttachment(task.id, file);
      }
      localStorage.removeItem(draftKey);
      setSelectedFiles([]);
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
          <input data-testid="task-create-title" value={form.title} onChange={(event) => update("title", event.target.value)} required minLength={3} />
        </label>
        <label>
          Mô tả
          <textarea data-testid="task-create-description" value={form.description} onChange={(event) => update("description", event.target.value)} rows={5} />
        </label>
        <label>
          Mức độ ưu tiên
          <select data-testid="task-create-priority" value={form.priority} onChange={(event) => update("priority", event.target.value)}>
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
          {"Người giao việc"}
          <select data-testid="task-create-assigner" value={form.assignerId} onChange={(event) => update("assignerId", event.target.value)}>
            <option value="">{"Mặc định là tôi"}</option>
            {(users.data?.data ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Người quản lý công việc
          <select data-testid="task-create-manager" value={form.managerId} onChange={(event) => update("managerId", event.target.value)}>
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
          <select data-testid="task-create-department" value={form.departmentId} onChange={(event) => update("departmentId", event.target.value)}>
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
          <input data-testid="task-create-start-date" type="date" value={form.startDate} onChange={(event) => update("startDate", event.target.value)} />
        </label>
        <label>
          Hạn hoàn thành
          <input data-testid="task-create-due-date" type="date" value={form.dueDate} onChange={(event) => update("dueDate", event.target.value)} />
        </label>
        <label>
          Danh mục
          <select data-testid="task-create-category" value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)}>
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
      <fieldset>
        <legend>{"Liên kết công việc"}</legend>
        <label>
          {"Tìm công việc"}
          <input
            data-testid="task-create-link-search"
            value={taskLinkKeyword}
            onChange={(event) => setTaskLinkKeyword(event.target.value)}
            placeholder="Nhập mã hoặc tên công việc"
          />
        </label>
        <label>
          {"Công việc cha"}
          <select data-testid="task-create-parent" value={form.parentTaskId} onChange={(event) => update("parentTaskId", event.target.value)}>
            <option value="">{"Không có công việc cha"}</option>
            {taskLinkItems.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name}
              </option>
            ))}
          </select>
        </label>
        <div data-testid="task-create-related-tasks">
          <MultiCheck
            label="Công việc liên quan"
            items={taskLinkItems.filter((task) => task.id !== form.parentTaskId)}
            value={form.relatedTaskIds}
            onChange={(value) => update("relatedTaskIds", value.filter((id) => id !== form.parentTaskId))}
          />
        </div>
        <label className="toggle-line">
          <input
            data-testid="task-create-auto-parent-progress"
            type="checkbox"
            checked={form.autoCalculateParentProgress}
            onChange={(event) => update("autoCalculateParentProgress", event.target.checked)}
          />
          {"Tự tính tiến độ từ công việc con"}
        </label>
      </fieldset>
      <fieldset>
        <legend>{"Tệp đính kèm"}</legend>
        <label>
          {"Chọn tệp"}
          <input
            data-testid="task-create-attachment-input"
            type="file"
            multiple
            accept={attachmentAccept}
            onChange={(event) => addFiles(event.target.files)}
          />
        </label>
        <div className="selected-files" data-testid="task-create-attachment-list">
          {selectedFiles.length === 0 ? (
            <span>{"Chưa chọn tệp."}</span>
          ) : (
            selectedFiles.map((file, index) => (
              <button
                key={`${file.name}-${file.lastModified}-${index}`}
                className="file-chip"
                type="button"
                onClick={() => setSelectedFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
              >
                <span>{file.name}</span>
                <small>{formatFileSize(file.size)}</small>
              </button>
            ))
          )}
        </div>
      </fieldset>
      {error && <p className="form-error full">{error}</p>}
      <div className="form-actions full">
        <button className="ghost-button" type="button" onClick={() => setPage("tasks")}>
          Hủy
        </button>
        <button className="primary-button" data-testid="task-create-save" type="submit" disabled={loading}>
          {loading && <Loader2 className="spin" size={16} />}
          Lưu công việc
        </button>
      </div>
    </form>
  );
}

export function TaskDetail({ taskId, setPage }: { taskId: string | null; setPage: (page: TaskPage) => void }) {
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  const [commentMentions, setCommentMentions] = useState<string[]>([]);
  const [replyToComment, setReplyToComment] = useState<{ id: string; authorName: string } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");
  const [evaluationMode, setEvaluationMode] = useState<TaskEvaluationMode | null>(null);
  const [evaluationRating, setEvaluationRating] = useState(5);
  const [evaluationComment, setEvaluationComment] = useState("");
  const [evaluationFiles, setEvaluationFiles] = useState<File[]>([]);
  const [evaluationError, setEvaluationError] = useState("");
  const [evaluationMessage, setEvaluationMessage] = useState("");
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

  const commentThreads = useMemo(() => {
    const comments = ((data?.comments ?? []) as Record<string, any>[]).filter((item) => !item.deletedAt);
    const repliesByParent = new Map<string, Record<string, any>[]>();
    for (const item of comments) {
      if (!item.parentCommentId) continue;
      const replies = repliesByParent.get(item.parentCommentId) ?? [];
      replies.push(item);
      repliesByParent.set(item.parentCommentId, replies);
    }
    return comments
      .filter((item) => !item.parentCommentId)
      .map((item) => ({ ...item, replies: repliesByParent.get(item.id) ?? [] }));
  }, [data?.comments]);

  function addFiles(files: FileList | null) {
    const result = collectAllowedAttachmentFiles(files);
    setLocalError(result.error);
    setSelectedFiles((current) => [...current, ...result.accepted]);
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

  function openEvaluation(mode: TaskEvaluationMode) {
    setEvaluationMode(mode);
    setEvaluationRating(5);
    setEvaluationComment("");
    setEvaluationFiles([]);
    setEvaluationError("");
    setEvaluationMessage("");
  }

  function closeEvaluation() {
    setEvaluationMode(null);
    setEvaluationComment("");
    setEvaluationFiles([]);
    setEvaluationError("");
  }

  function addEvaluationFiles(files: FileList | null) {
    const result = collectAllowedAttachmentFiles(files);
    setEvaluationError(result.error);
    setEvaluationFiles((current) => [...current, ...result.accepted]);
  }

  async function submitEvaluation(event: FormEvent) {
    event.preventDefault();
    if (!taskId || !evaluationMode) return;
    if (evaluationMode === "redo" && !evaluationComment.trim()) {
      setEvaluationError("Vui lòng nhập lý do yêu cầu làm lại.");
      return;
    }
    setBusy(true);
    setEvaluationError("");
    setEvaluationMessage("");
    try {
      const uploaded: Record<string, any>[] = [];
      for (const file of evaluationFiles) {
        uploaded.push(await api.uploadTaskAttachment(taskId, file));
      }
      await api.evaluateTask(taskId, {
        accepted: evaluationMode === "accept",
        rating: evaluationMode === "accept" ? evaluationRating : undefined,
        comment: evaluationComment.trim(),
        attachmentIds: uploaded.map((attachment) => attachment.id)
      });
      closeEvaluation();
      setEvaluationMessage("Đã đánh giá công việc thành công.");
      await reload();
    } catch (err) {
      setEvaluationError(err instanceof Error ? err.message : "Không đánh giá được công việc.");
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
        parentCommentId: replyToComment?.id,
        attachmentIds: uploaded.map((attachment) => attachment.id)
      });
      setComment("");
      setReplyToComment(null);
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
          <span className={cls("status-chip", data.displayStatus)} data-testid="task-detail-status">
            {statusLabels[data.displayStatus ?? data.status]}
          </span>
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
            <b data-testid="task-detail-progress">{data.progress}%</b>
          </span>
        </div>
        {(data.parentTask || data.subTasks?.length || data.dependenciesFrom?.length) && (
          <section className="stack-list" data-testid="task-relations">
            {data.parentTask && (
              <span>
                <small>{"Công việc cha"}</small>
                <strong>{data.parentTask.code} - {data.parentTask.title}</strong>
              </span>
            )}
            {(data.subTasks ?? []).length > 0 && (
              <span>
                <small>{"Công việc con"}</small>
                <strong>
                  {data.subTasks.map((task: Record<string, any>) => `${task.code} - ${task.title}`).join(", ")}
                  {data.subTaskProgress !== null && data.subTaskProgress !== undefined ? ` (${data.subTaskProgress}%)` : ""}
                </strong>
              </span>
            )}
            {(data.dependenciesFrom ?? []).length > 0 && (
              <span>
                <small>{"Công việc liên quan"}</small>
                <strong>
                  {data.dependenciesFrom
                    .map((dependency: Record<string, any>) => dependency.targetTask)
                    .filter(Boolean)
                    .map((task: Record<string, any>) => `${task.code} - ${task.title}`)
                    .join(", ")}
                </strong>
              </span>
            )}
          </section>
        )}
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
          <input
            data-testid="task-progress-range"
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={(event) => setProgress(Number(event.target.value))}
          />
          <textarea
            data-testid="task-progress-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ghi chú tiến độ"
          />
          <button
            className="primary-button compact"
            data-testid="task-progress-submit"
            type="button"
            disabled={busy}
            onClick={() => void saveProgress()}
          >
            Cập nhật tiến độ
          </button>
        </div>
        <div className="approval-actions">
          <button className="primary-button" data-testid="task-evaluate-accept" type="button" disabled={busy} onClick={() => openEvaluation("accept")}>
            Xác nhận hoàn thành
          </button>
          <button className="danger-button" data-testid="task-evaluate-redo" type="button" disabled={busy} onClick={() => openEvaluation("redo")}>
            Yêu cầu làm lại
          </button>
        </div>
        {evaluationMode && (
          <form className="task-evaluation-panel" data-testid="task-evaluation-panel" onSubmit={submitEvaluation}>
            <div>
              <h3>{evaluationMode === "accept" ? "Đánh giá hoàn thành" : "Yêu cầu thực hiện lại"}</h3>
              <p>{evaluationMode === "accept" ? "Chấm chất lượng và ghi nhận xét cho kết quả công việc." : "Nhập lý do rõ ràng để người thực hiện tiếp tục xử lý."}</p>
            </div>
            {evaluationMode === "accept" && (
              <div className="rating-picker" data-testid="task-evaluation-rating">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    className={cls("icon-button", evaluationRating >= rating && "active-rating")}
                    data-testid={"task-evaluation-rating-" + rating}
                    type="button"
                    title={`${rating} sao`}
                    onClick={() => setEvaluationRating(rating)}
                  >
                    <Star size={18} />
                  </button>
                ))}
              </div>
            )}
            <label>
              Nhận xét
              <textarea
                data-testid="task-evaluation-comment"
                value={evaluationComment}
                rows={3}
                placeholder={evaluationMode === "accept" ? "Nhận xét kết quả" : "Lý do yêu cầu làm lại"}
                onChange={(event) => {
                  setEvaluationComment(event.target.value);
                  setEvaluationError("");
                }}
              />
            </label>
            <label className="file-picker compact-file-picker">
              <Upload size={16} />
              Tệp xác nhận
              <input
                data-testid="task-evaluation-attachment-input"
                type="file"
                multiple
                accept={attachmentAccept}
                onChange={(event) => {
                  addEvaluationFiles(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <div className="selected-files" data-testid="task-evaluation-attachment-list">
              {evaluationFiles.length === 0 ? (
                <span>{"Chưa chọn tệp xác nhận."}</span>
              ) : (
                evaluationFiles.map((file, index) => (
                  <span key={`${file.name}-${file.lastModified}-${index}`}>
                    <b>{file.name}</b>
                    <small>{formatFileSize(file.size)}</small>
                    <button
                      type="button"
                      title="Bỏ tệp"
                      onClick={() => setEvaluationFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                    >
                      <XCircle size={16} />
                    </button>
                  </span>
                ))
              )}
            </div>
            {evaluationError && <p className="form-error">{evaluationError}</p>}
            <div className="form-actions">
              <button className="ghost-button" data-testid="task-evaluation-cancel" type="button" disabled={busy} onClick={closeEvaluation}>
                Hủy
              </button>
              <button className={evaluationMode === "redo" ? "danger-button" : "primary-button"} data-testid="task-evaluation-submit" type="submit" disabled={busy}>
                {busy && <Loader2 className="spin" size={16} />}
                Xác nhận
              </button>
            </div>
          </form>
        )}
        {evaluationMessage && <p className="success-text" data-testid="task-evaluation-message">{evaluationMessage}</p>}
      </article>

      <aside className="panel">
        <div className="panel-head">
          <h2>Trao đổi</h2>
        </div>
        <div className="comment-list">
          {commentThreads.map((item: Record<string, any>) => (
            <div key={item.id} className="comment-item" data-testid={`task-comment-${item.id}`}>
              <div className="comment-body">
                <strong>{item.author?.fullName}</strong>
                <p>{item.content}</p>
                <AttachmentList
                  attachments={item.attachments ?? []}
                  downloadingId={downloadingId}
                  onDownload={(attachment) => void downloadAttachment(attachment)}
                />
                <div className="comment-meta">
                  <small>{formatDate(item.createdAt)}</small>
                  <button
                    className="ghost-button compact"
                    data-testid={`task-comment-reply-${item.id}`}
                    type="button"
                    onClick={() => setReplyToComment({ id: item.id, authorName: item.author?.fullName ?? "bình luận" })}
                  >
                    Trả lời
                  </button>
                </div>
              </div>
              {(item.replies ?? []).length > 0 && (
                <div className="comment-replies" data-testid={`task-comment-replies-${item.id}`}>
                  {(item.replies ?? []).map((reply: Record<string, any>) => (
                    <div key={reply.id} className="comment-item comment-reply" data-testid={`task-comment-${reply.id}`}>
                      <strong>{reply.author?.fullName}</strong>
                      <p>{reply.content}</p>
                      <AttachmentList
                        attachments={reply.attachments ?? []}
                        downloadingId={downloadingId}
                        onDownload={(attachment) => void downloadAttachment(attachment)}
                      />
                      <small>{formatDate(reply.createdAt)}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <form className="comment-form" onSubmit={sendComment}>
          {replyToComment && (
            <div className="reply-banner" data-testid="task-comment-replying">
              <span>Đang trả lời {replyToComment.authorName}</span>
              <button className="ghost-button compact" type="button" onClick={() => setReplyToComment(null)}>
                Hủy trả lời
              </button>
            </div>
          )}
          <textarea
            data-testid="task-comment-input"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={replyToComment ? `Trả lời ${replyToComment.authorName}` : "Nhập bình luận"}
          />
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
                data-testid="task-attachment-input"
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
          <button className="primary-button compact" data-testid="task-comment-submit" type="submit" disabled={busy}>
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
        <button
          key={attachment.id}
          data-testid={`attachment-download-${attachment.id}`}
          type="button"
          onClick={() => onDownload(attachment)}
          disabled={downloadingId === attachment.id}
        >
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
