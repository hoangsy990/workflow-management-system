import { Loader2, Plus, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { api } from "../api/client";
import { DataTable, ErrorBlock, LoadingBlock } from "../components/common";
import { useAsyncData } from "../hooks/useAsyncData";
import { formatDate, statusLabels } from "../lib/format";

type WorkflowPage = "workflowTemplates" | "workflowBuilder" | "workflowInstances" | "newInstance" | "instanceDetail";

interface WorkflowPageProps {
  setPage: (page: WorkflowPage) => void;
  setInstanceId: (id: string) => void;
}


export function WorkflowTemplates({ setPage }: WorkflowPageProps) {
  const { data, loading, error } = useAsyncData(() => api.workflowTemplates(), []);
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  return (
    <section className="panel">
      <div className="panel-head wrap">
        <h2>Mẫu quy trình</h2>
        <button className="primary-button compact" data-testid="workflow-template-create" type="button" onClick={() => setPage("workflowBuilder")}>
          <Plus size={16} />
          Tạo mẫu
        </button>
      </div>
      <DataTable
        columns={["Mã", "Tên", "Danh mục", "Trạng thái", "Phiên bản"]}
        rows={(data ?? []).map((template) => ({
          key: template.id,
          testId: `workflow-template-row-${template.id}`,
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

type WorkflowFieldDraft = {
  id: string;
  name: string;
  code: string;
  type: string;
  isRequired: boolean;
  placeholder: string;
};

type WorkflowApprovalStepDraft = {
  id: string;
  code: string;
  name: string;
  resolverType: string;
  approvalMode: string;
  completionRule: string;
  deadlineAmount: number;
  deadlineUnit: string;
};

const fieldTypeOptions = [
  ["SHORT_TEXT", "Văn bản ngắn"],
  ["LONG_TEXT", "Văn bản nhiều dòng"],
  ["NUMBER", "Số"],
  ["CURRENCY", "Tiền tệ"],
  ["DATE", "Ngày"],
  ["DATETIME", "Ngày giờ"],
  ["CHECKBOX", "Checkbox"],
  ["RADIO", "Radio"],
  ["SELECT", "Danh sách lựa chọn"],
  ["USER_SELECT", "Danh sách người dùng"],
  ["DEPARTMENT_SELECT", "Danh sách phòng ban"],
  ["ATTACHMENT", "Tệp đính kèm"],
  ["TABLE", "Bảng nhiều dòng"],
  ["HEADING", "Tiêu đề"],
] as const;

const resolverTypeOptions = [
  ["REQUESTER_MANAGER", "Quản lý trực tiếp"],
  ["REQUESTER_DEPARTMENT_HEAD", "Trưởng phòng người tạo"],
  ["PREVIOUS_STEP_ASSIGNEE", "Người xử lý bước trước"]
] as const;

function normalizeWorkflowCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function newWorkflowField(index: number): WorkflowFieldDraft {
  if (index === 1) {
    return {
      id: crypto.randomUUID(),
      name: "Nội dung",
      code: "purpose",
      type: "SHORT_TEXT",
      isRequired: true,
      placeholder: ""
    };
  }
  if (index === 2) {
    return {
      id: crypto.randomUUID(),
      name: "Số tiền",
      code: "amount",
      type: "CURRENCY",
      isRequired: true,
      placeholder: ""
    };
  }
  return {
    id: crypto.randomUUID(),
    name: "Trường " + index,
    code: "field_" + index,
    type: "SHORT_TEXT",
    isRequired: false,
    placeholder: ""
  };
}

function newApprovalStep(index: number): WorkflowApprovalStepDraft {
  return {
    id: crypto.randomUUID(),
    code: index === 1 ? "manager" : "approval_" + index,
    name: index === 1 ? "Quản lý trực tiếp duyệt" : "Bước duyệt " + index,
    resolverType: index === 1 ? "REQUESTER_MANAGER" : "PREVIOUS_STEP_ASSIGNEE",
    approvalMode: "SEQUENTIAL",
    completionRule: "ALL",
    deadlineAmount: 1,
    deadlineUnit: "DAY"
  };
}

export function WorkflowBuilder({ setPage }: WorkflowPageProps) {
  const [form, setForm] = useState({
    code: "",
    name: "",
    category: "",
    description: ""
  });
  const [fields, setFields] = useState<WorkflowFieldDraft[]>([newWorkflowField(1), newWorkflowField(2)]);
  const [approvalSteps, setApprovalSteps] = useState<WorkflowApprovalStepDraft[]>([newApprovalStep(1)]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(id: string, patch: Partial<WorkflowFieldDraft>) {
    setFields((current) => current.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  }

  function updateStep(id: string, patch: Partial<WorkflowApprovalStepDraft>) {
    setApprovalSteps((current) => current.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  }

  function validateBuilder() {
    const fieldCodes = fields.map((field) => normalizeWorkflowCode(field.code));
    const stepCodes = approvalSteps.map((step) => normalizeWorkflowCode(step.code));
    if (fields.length === 0) return "Cần ít nhất một trường biểu mẫu.";
    if (approvalSteps.length === 0) return "Cần ít nhất một bước duyệt.";
    if (fieldCodes.some((code) => !code)) return "Mã trường không được để trống.";
    if (stepCodes.some((code) => !code)) return "Mã bước không được để trống.";
    if (new Set(fieldCodes).size !== fieldCodes.length) return "Mã trường không được trùng.";
    if (new Set(stepCodes).size !== stepCodes.length) return "Mã bước không được trùng.";
    return "";
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validationError = validateBuilder();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const normalizedSteps = approvalSteps.map((step, index) => ({ ...step, code: normalizeWorkflowCode(step.code), orderIndex: index + 2 }));
      await api.createWorkflowTemplate({
        code: form.code.trim(),
        name: form.name.trim(),
        category: form.category.trim() || undefined,
        description: form.description.trim() || undefined,
        activate: true,
        fields: fields.map((field, index) => ({
          name: field.name.trim(),
          code: normalizeWorkflowCode(field.code),
          type: field.type,
          isRequired: field.isRequired,
          placeholder: field.placeholder.trim() || undefined,
          displayOrder: index + 1
        })),
        steps: [
          { code: "start", name: "Bắt đầu", type: "START", orderIndex: 1 },
          ...normalizedSteps.map((step) => ({
            code: step.code,
            name: step.name.trim(),
            type: "APPROVAL",
            orderIndex: step.orderIndex,
            approvalMode: step.approvalMode,
            completionRule: step.completionRule,
            deadlineAmount: step.deadlineAmount || undefined,
            deadlineUnit: step.deadlineUnit,
            assignees: [{ resolverType: step.resolverType, orderIndex: 1 }]
          })),
          { code: "end", name: "Kết thúc", type: "END", orderIndex: normalizedSteps.length + 2 }
        ],
        transitions: normalizedSteps.map((step, index) => ({
          fromStepCode: step.code,
          toStepCode: normalizedSteps[index + 1]?.code ?? "end",
          priority: index + 1
        }))
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
        <h2>{"Tạo mẫu quy trình"}</h2>
      </div>
      <fieldset>
        <legend>{"Thông tin mẫu"}</legend>
        <label>
          {"Mã quy trình"}
          <input data-testid="workflow-template-code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required />
        </label>
        <label>
          {"Tên quy trình"}
          <input data-testid="workflow-template-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label>
          {"Danh mục"}
          <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
        </label>
        <label>
          {"Mô tả"}
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </label>
      </fieldset>
      <fieldset className="builder-list">
        <legend>{"Biểu mẫu"}</legend>
        {fields.map((field, index) => (
          <div className="builder-row" key={field.id}>
            <input
              data-testid={"workflow-field-name-" + index}
              placeholder="Tên trường"
              value={field.name}
              onChange={(event) => updateField(field.id, { name: event.target.value, code: field.code || normalizeWorkflowCode(event.target.value) })}
              required
            />
            <input
              data-testid={"workflow-field-code-" + index}
              placeholder="field_code"
              value={field.code}
              onChange={(event) => updateField(field.id, { code: event.target.value })}
              required
            />
            <select value={field.type} onChange={(event) => updateField(field.id, { type: event.target.value })}>
              {fieldTypeOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label className="toggle-line compact-toggle">
              <input type="checkbox" checked={field.isRequired} onChange={(event) => updateField(field.id, { isRequired: event.target.checked })} />
              {"Bắt buộc"}
            </label>
            <input placeholder="Gợi ý" value={field.placeholder} onChange={(event) => updateField(field.id, { placeholder: event.target.value })} />
            <button className="icon-button" type="button" title="Xóa trường" disabled={fields.length <= 1} onClick={() => setFields((current) => current.filter((item) => item.id !== field.id))}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button className="ghost-button compact" data-testid="workflow-field-add" type="button" onClick={() => setFields((current) => [...current, newWorkflowField(current.length + 1)])}>
          <Plus size={16} />
          {"Thêm trường"}
        </button>
      </fieldset>
      <fieldset className="builder-list">
        <legend>{"Bước duyệt"}</legend>
        {approvalSteps.map((step, index) => (
          <div className="builder-row" key={step.id}>
            <input
              data-testid={"workflow-step-name-" + index}
              placeholder="Tên bước"
              value={step.name}
              onChange={(event) => updateStep(step.id, { name: event.target.value, code: step.code || normalizeWorkflowCode(event.target.value) })}
              required
            />
            <input
              data-testid={"workflow-step-code-" + index}
              placeholder="step_code"
              value={step.code}
              onChange={(event) => updateStep(step.id, { code: event.target.value })}
              required
            />
            <select value={step.resolverType} onChange={(event) => updateStep(step.id, { resolverType: event.target.value })}>
              {resolverTypeOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select value={step.approvalMode} onChange={(event) => updateStep(step.id, { approvalMode: event.target.value })}>
              <option value="SEQUENTIAL">{"Tuần tự"}</option>
              <option value="PARALLEL">{"Đồng thời"}</option>
            </select>
            <select value={step.completionRule} onChange={(event) => updateStep(step.id, { completionRule: event.target.value })}>
              <option value="ALL">{"Tất cả"}</option>
              <option value="ANY">{"Một người"}</option>
            </select>
            <input type="number" min={0} value={step.deadlineAmount} onChange={(event) => updateStep(step.id, { deadlineAmount: Number(event.target.value) })} />
            <select value={step.deadlineUnit} onChange={(event) => updateStep(step.id, { deadlineUnit: event.target.value })}>
              <option value="HOUR">{"Giờ"}</option>
              <option value="DAY">{"Ngày"}</option>
            </select>
            <button className="icon-button" type="button" title="Xóa bước" disabled={approvalSteps.length <= 1} onClick={() => setApprovalSteps((current) => current.filter((item) => item.id !== step.id))}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button className="ghost-button compact" data-testid="workflow-step-add" type="button" onClick={() => setApprovalSteps((current) => [...current, newApprovalStep(current.length + 1)])}>
          <Plus size={16} />
          {"Thêm bước"}
        </button>
      </fieldset>
      {error && <p className="form-error full">{error}</p>}
      <div className="form-actions full">
        <button className="ghost-button" type="button" onClick={() => setPage("workflowTemplates")}>
          {"Hủy"}
        </button>
        <button className="primary-button" data-testid="workflow-template-save" type="submit" disabled={loading}>
          {loading && <Loader2 className="spin" size={16} />}
          {"Lưu mẫu"}
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
