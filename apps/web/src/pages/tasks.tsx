import { Download, Loader2, Plus, Search, Upload, XCircle } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { DataTable, ErrorBlock, LoadingBlock, MultiCheck } from "../components/common";
import { useAsyncData } from "../hooks/useAsyncData";

type TaskPage = "tasks" | "newTask" | "taskDetail";

interface TaskPageProps {
  setPage: (page: TaskPage) => void;
  setTaskId: (id: string) => void;
}

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
export function TaskList({ mode, setPage, setTaskId }: TaskPageProps & { mode: "all" | "mine" }) {
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
          testId: `task-row-${task.id}`,
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

export function Kanban({ setPage, setTaskId }: TaskPageProps) {
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

export function CalendarPage({ setPage, setTaskId }: TaskPageProps) {
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

export function TaskForm({ setPage, setTaskId }: TaskPageProps) {
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

export function TaskDetail({ taskId, setPage }: { taskId: string | null; setPage: (page: TaskPage) => void }) {
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
          <textarea
            data-testid="task-comment-input"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Nhập bình luận"
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
