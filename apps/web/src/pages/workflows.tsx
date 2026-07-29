import { Loader2, Plus } from "lucide-react";
import { FormEvent, useState } from "react";
import { api } from "../api/client";
import { DataTable, ErrorBlock, LoadingBlock } from "../components/common";
import { useAsyncData } from "../hooks/useAsyncData";

type WorkflowPage = "workflowTemplates" | "workflowBuilder" | "workflowInstances" | "newInstance" | "instanceDetail";

interface WorkflowPageProps {
  setPage: (page: WorkflowPage) => void;
  setInstanceId: (id: string) => void;
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

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh"
  }).format(new Date(value));
}

export function WorkflowTemplates({ setPage }: WorkflowPageProps) {
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

export function WorkflowBuilder({ setPage }: WorkflowPageProps) {
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

export function WorkflowInstances({ setPage, setInstanceId, pendingMine = false }: WorkflowPageProps & { pendingMine?: boolean }) {
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
          testId: `workflow-instance-row-${instance.id}`,
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

export function NewWorkflowInstance({ setPage, setInstanceId }: WorkflowPageProps) {
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

export function WorkflowInstanceDetail({ instanceId, setPage }: { instanceId: string | null; setPage: (page: WorkflowPage) => void }) {
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
          <span className="status-chip" data-testid="workflow-instance-status">
            {statusLabels[data.status] ?? data.status}
          </span>
        </div>
        <div className="json-view">{JSON.stringify(data.formData ?? {}, null, 2)}</div>
        <div className="approval-actions">
          <button
            className="primary-button"
            data-testid="workflow-action-approve"
            type="button"
            disabled={busy}
            onClick={() => void act("APPROVE")}
          >
            Duyệt
          </button>
          <button
            className="danger-button"
            data-testid="workflow-action-reject"
            type="button"
            disabled={busy}
            onClick={() => void act("REJECT")}
          >
            Từ chối
          </button>
          <button
            className="ghost-button"
            data-testid="workflow-action-request-info"
            type="button"
            disabled={busy}
            onClick={() => void act("REQUEST_INFO")}
          >
            Yêu cầu bổ sung
          </button>
          <button
            className="ghost-button"
            data-testid="workflow-action-return"
            type="button"
            disabled={busy}
            onClick={() => void act("RETURN")}
          >
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
