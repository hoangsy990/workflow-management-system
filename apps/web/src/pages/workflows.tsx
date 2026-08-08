import { CheckCircle2, CircleDot, Clock3, Download, GitBranch, Loader2, Monitor, Plus, RotateCcw, Smartphone, Trash2, Upload, XCircle } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
  const [compareLeftId, setCompareLeftId] = useState("");
  const [compareRightId, setCompareRightId] = useState("");
  const [compareResult, setCompareResult] = useState<Record<string, any> | null>(null);
  const [compareError, setCompareError] = useState("");
  const [compareLoading, setCompareLoading] = useState(false);
  const { data, loading, error } = useAsyncData(() => api.workflowTemplates(), []);
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  const versionOptions = (data ?? []).flatMap((template) =>
    (template.versions ?? []).map((version: Record<string, any>) => ({
      id: version.id,
      label: `${template.code} - v${version.versionNo} (${statusLabels[version.status] ?? version.status})`
    }))
  );

  async function runCompare() {
    if (!compareLeftId || !compareRightId || compareLeftId === compareRightId) {
      setCompareError("Vui lòng chọn hai phiên bản khác nhau.");
      return;
    }
    setCompareLoading(true);
    setCompareError("");
    setCompareResult(null);
    try {
      setCompareResult(await api.compareWorkflowVersions(compareLeftId, compareRightId));
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : "Không so sánh được phiên bản.");
    } finally {
      setCompareLoading(false);
    }
  }

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
      <div className="version-compare" data-testid="workflow-version-compare">
        <div>
          <h3>So sánh phiên bản</h3>
          <p>Chọn hai phiên bản để kiểm tra thay đổi về biểu mẫu, bước xử lý và luồng chuyển bước.</p>
        </div>
        <div className="compare-controls">
          <select data-testid="workflow-version-compare-left" value={compareLeftId} onChange={(event) => setCompareLeftId(event.target.value)}>
            <option value="">Phiên bản A</option>
            {versionOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <select data-testid="workflow-version-compare-right" value={compareRightId} onChange={(event) => setCompareRightId(event.target.value)}>
            <option value="">Phiên bản B</option>
            {versionOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            className="ghost-button compact"
            data-testid="workflow-version-compare-run"
            type="button"
            disabled={compareLoading || versionOptions.length < 2}
            onClick={runCompare}
          >
            {compareLoading && <Loader2 className="spin" size={16} />}
            So sánh
          </button>
        </div>
        {compareError && <p className="form-error">{compareError}</p>}
        {compareResult && (
          <div className="compare-result" data-testid="workflow-version-compare-result">
            <span>Trường: {compareResult.summary?.fieldsChanged ? "Có thay đổi" : "Không đổi"}</span>
            <span>Bước xử lý: {compareResult.summary?.stepsChanged ? "Có thay đổi" : "Không đổi"}</span>
            <span>Luồng chuyển: {compareResult.summary?.transitionsChanged ? "Có thay đổi" : "Không đổi"}</span>
            <small>
              v{compareResult.left?.versionNo} có {compareResult.left?.fields?.length ?? 0} trường / {compareResult.left?.steps?.length ?? 0} bước; v
              {compareResult.right?.versionNo} có {compareResult.right?.fields?.length ?? 0} trường / {compareResult.right?.steps?.length ?? 0} bước.
            </small>
          </div>
        )}
      </div>
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
  defaultValue: string;
  minLength: string;
  maxLength: string;
  minValue: string;
  maxValue: string;
  optionText: string;
  layoutTab: string;
  layoutSection: string;
  layoutColumnSpan: string;
  visibleWhenFieldCode: string;
  visibleWhenOperator: string;
  visibleWhenValue: string;
  calculationOperator: string;
  calculationFieldCodes: string;
  catalogSourceCode: string;
  tableColumnsText: string;
  editableStepCodes: string[];
  visibleRoleCodes: string[];
};

type WorkflowApprovalStepDraft = {
  id: string;
  code: string;
  name: string;
  resolverType: string;
  approvalMode: string;
  completionRule: string;
  minCount: number;
  minPercent: number;
  deadlineAmount: number;
  deadlineUnit: string;
  reminderBeforeHours: number;
  conditionalNext: boolean;
  conditionFieldCode: string;
  conditionOperator: string;
  conditionValue: string;
};

type WorkflowFormField = {
  id?: string;
  name: string;
  code: string;
  type: string;
  isRequired?: boolean;
  defaultValue?: unknown;
  placeholder?: string | null;
  validation?: WorkflowValidationRules | null;
  displayOrder?: number;
  editableBySteps?: unknown;
  visibleToRoles?: string[] | null;
};

type RoleSummary = {
  id?: string;
  code: string;
  name: string;
};

const emptyWorkflowFields: WorkflowFormField[] = [];
const emptyWorkflowRoles: Array<{ code?: string }> = [];

type WorkflowValidationRules = {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  options?: string[];
  layout?: {
    tab?: string;
    section?: string;
    columnSpan?: number;
  };
  visibleWhen?: {
    fieldCode: string;
    operator: string;
    compareValue?: unknown;
    groupType?: "AND" | "OR";
  };
  calculation?: {
    operator: string;
    fieldCodes: string[];
  };
  catalogSource?: {
    catalogCode: string;
    valueField?: string;
    labelField?: string;
  };
  tableColumns?: Array<{
    code: string;
    name: string;
    type: string;
    required?: boolean;
  }>;
};

type WorkflowVersionDetail = {
  id: string;
  versionNo: number;
  status: string;
  fields?: WorkflowFormField[];
  allowedStarters?: WorkflowAllowedStarters | null;
};

type WorkflowAllowedStarters = {
  roleCodes?: string[];
  userIds?: string[];
  departmentIds?: string[];
};

type WorkflowTemplateDetail = {
  id: string;
  name: string;
  code: string;
  versions?: WorkflowVersionDetail[];
};

type WorkflowActionType = "APPROVE" | "REJECT" | "REQUEST_INFO" | "RETURN" | "TRANSFER";

type WorkflowApprovalSummary = {
  id: string;
  status: string;
  action?: string | null;
  comment?: string | null;
  actedAt?: string | null;
  createdAt?: string | null;
  approver?: { id: string; fullName: string } | null;
};

type WorkflowVersionStepSummary = {
  id: string;
  code: string;
  name: string;
  type: string;
  orderIndex: number;
  approvalMode?: string | null;
  completionRule?: string | null;
  minCount?: number | null;
  minPercent?: number | null;
  deadlineAmount?: number | null;
  deadlineUnit?: string | null;
};

type WorkflowInstanceStepSummary = {
  id: string;
  stepId: string;
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
  deadlineAt?: string | null;
  createdAt?: string | null;
  step?: WorkflowVersionStepSummary | null;
  approvals?: WorkflowApprovalSummary[];
};

type WorkflowTransitionSummary = {
  id?: string;
  name?: string | null;
  fromStepId?: string;
  toStepId?: string;
  fromStep?: WorkflowVersionStepSummary | null;
  toStep?: WorkflowVersionStepSummary | null;
  conditions?: Array<{ fieldCode: string; operator: string; compareValue: unknown; groupType?: string }>;
};

type WorkflowTrackerState = "done" | "current" | "blocked" | "upcoming" | "skipped";

type WorkflowTrackerNode = {
  step: WorkflowVersionStepSummary;
  runtimeSteps: WorkflowInstanceStepSummary[];
  approvals: WorkflowApprovalSummary[];
  state: WorkflowTrackerState;
  pendingApprovers: string[];
  completedApprovers: string[];
  transitionLabel: string;
};

const workflowActionLabels: Record<WorkflowActionType, string> = {
  APPROVE: "Duyệt hồ sơ",
  REJECT: "Từ chối hồ sơ",
  REQUEST_INFO: "Yêu cầu bổ sung",
  RETURN: "Trả về bước trước",
  TRANSFER: "Chuyển xử lý"
};

const workflowApprovalStatusLabels: Record<string, string> = {
  PENDING: "Chờ xử lý",
  APPROVED: "Đã duyệt",
  REJECTED: "Bị từ chối",
  REQUESTED_INFO: "Yêu cầu bổ sung",
  RETURNED: "Đã trả bước",
  TRANSFERRED: "Đã chuyển xử lý",
  SKIPPED: "Bỏ qua"
};

const workflowActionHistoryLabels: Record<string, string> = {
  SUBMIT: "Gửi hồ sơ",
  APPROVE: "Duyệt",
  REJECT: "Từ chối",
  REQUEST_INFO: "Yêu cầu bổ sung",
  RETURN: "Trả bước",
  TRANSFER: "Chuyển xử lý",
  COMMENT: "Bình luận",
  CANCEL: "Hủy"
};

const workflowStepStateLabels: Record<WorkflowTrackerState, string> = {
  done: "Đã hoàn tất",
  current: "Đang xử lý",
  blocked: "Cần chú ý",
  upcoming: "Chưa tới bước",
  skipped: "Bỏ qua"
};
const maxWorkflowAttachmentMb = 20;
const allowedWorkflowAttachmentTypes = new Set([
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
const workflowAttachmentAccept = [...allowedWorkflowAttachmentTypes].join(",");

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

const conditionOperatorOptions = [
  ["gt", "Lớn hơn"],
  ["gte", "Lớn hơn hoặc bằng"],
  ["lt", "Nhỏ hơn"],
  ["lte", "Nhỏ hơn hoặc bằng"],
  ["eq", "Bằng"],
  ["neq", "Khác"],
  ["contains", "Có chứa"],
  ["exists", "Có dữ liệu"]
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
      placeholder: "",
      defaultValue: "",
      minLength: "",
      maxLength: "",
      minValue: "",
      maxValue: "",
      optionText: "",
      layoutTab: "Thông tin chung",
      layoutSection: "Nội dung đề xuất",
      layoutColumnSpan: "1",
      visibleWhenFieldCode: "",
      visibleWhenOperator: "eq",
      visibleWhenValue: "",
      calculationOperator: "SUM",
      calculationFieldCodes: "",
      catalogSourceCode: "",
      tableColumnsText: "",
      editableStepCodes: [],
      visibleRoleCodes: []
    };
  }
  if (index === 2) {
    return {
      id: crypto.randomUUID(),
      name: "Số tiền",
      code: "amount",
      type: "CURRENCY",
      isRequired: true,
      placeholder: "",
      defaultValue: "",
      minLength: "",
      maxLength: "",
      minValue: "",
      maxValue: "",
      optionText: "",
      layoutTab: "Thông tin chung",
      layoutSection: "Chi phí",
      layoutColumnSpan: "1",
      visibleWhenFieldCode: "",
      visibleWhenOperator: "eq",
      visibleWhenValue: "",
      calculationOperator: "SUM",
      calculationFieldCodes: "",
      catalogSourceCode: "",
      tableColumnsText: "",
      editableStepCodes: [],
      visibleRoleCodes: []
    };
  }
  return {
    id: crypto.randomUUID(),
    name: "Trường " + index,
    code: "field_" + index,
    type: "SHORT_TEXT",
    isRequired: false,
    placeholder: "",
    defaultValue: "",
    minLength: "",
    maxLength: "",
    minValue: "",
    maxValue: "",
    optionText: "",
    layoutTab: "",
    layoutSection: "",
    layoutColumnSpan: "1",
    visibleWhenFieldCode: "",
    visibleWhenOperator: "eq",
    visibleWhenValue: "",
    calculationOperator: "SUM",
    calculationFieldCodes: "",
    catalogSourceCode: "",
    tableColumnsText: "",
    editableStepCodes: [],
    visibleRoleCodes: []
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
    minCount: 1,
    minPercent: 50,
    deadlineAmount: 1,
    deadlineUnit: "DAY",
    reminderBeforeHours: 24,
    conditionalNext: false,
    conditionFieldCode: "amount",
    conditionOperator: "gt",
    conditionValue: "50000000"
  };
}

function parseConditionValue(value: string) {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (!Number.isNaN(Number(trimmed))) return Number(trimmed);
  if (trimmed.toLowerCase() === "true") return true;
  if (trimmed.toLowerCase() === "false") return false;
  return trimmed;
}

function supportsTextValidation(type: string) {
  return type === "SHORT_TEXT" || type === "LONG_TEXT" || type === "SELECT" || type === "RADIO" || type === "TABLE";
}

function supportsNumberValidation(type: string) {
  return type === "NUMBER" || type === "CURRENCY";
}

function supportsChoiceOptions(type: string) {
  return type === "SELECT" || type === "RADIO";
}

function parseWorkflowOptions(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((option) => option.trim())
        .filter(Boolean)
    )
  );
}

function workflowFieldOptions(field: { validation?: WorkflowValidationRules | null }) {
  return Array.isArray(field.validation?.options) ? field.validation.options.filter((option) => option.trim() !== "") : [];
}

function workflowFieldLayout(field: { validation?: WorkflowValidationRules | null }) {
  return field.validation?.layout ?? {};
}

function workflowFieldVisibleWhen(field: { validation?: WorkflowValidationRules | null }) {
  return field.validation?.visibleWhen ?? null;
}

function workflowFieldCalculation(field: { validation?: WorkflowValidationRules | null }) {
  return field.validation?.calculation ?? null;
}

function workflowCatalogSource(field: { validation?: WorkflowValidationRules | null }) {
  return field.validation?.catalogSource ?? null;
}

function workflowTableColumns(field: { validation?: WorkflowValidationRules | null }) {
  return Array.isArray(field.validation?.tableColumns) ? field.validation.tableColumns : [];
}

function parseWorkflowTableColumns(value: string): { columns?: WorkflowValidationRules["tableColumns"]; error?: string } {
  const rows = value
    .split(/\n/)
    .map((row) => row.trim())
    .filter(Boolean);
  if (rows.length === 0) {
    return {};
  }

  const columns = rows.map((row) => {
    const parts = row.split("|").map((part) => part.trim());
    const rawCode = parts[0] ?? "";
    const rawName = parts[1] ?? "";
    const rawType = parts[2] ?? "";
    const rawRequired = parts[3] ?? "";
    return {
      code: normalizeWorkflowCode(rawCode),
      name: rawName,
      type: rawType || "SHORT_TEXT",
      required: rawRequired === "required" || rawRequired === "true" || rawRequired === "bat_buoc"
    };
  });
  const invalid = columns.find((column) => !column.code || !column.name || !["SHORT_TEXT", "NUMBER", "CURRENCY", "DATE"].includes(column.type));
  if (invalid) {
    return { error: "Cột bảng cần nhập theo dạng code|Tên cột|SHORT_TEXT/NUMBER/CURRENCY/DATE|required." };
  }
  if (new Set(columns.map((column) => column.code)).size !== columns.length) {
    return { error: "Mã cột trong bảng không được trùng." };
  }
  return { columns };
}

function compareWorkflowValue(actual: unknown, operator: string, expected: unknown) {
  const normalizedActual = typeof actual === "string" && actual.trim() && !Number.isNaN(Number(actual)) ? Number(actual) : actual;
  const normalizedExpected = typeof expected === "string" && expected.trim() && !Number.isNaN(Number(expected)) ? Number(expected) : expected;
  switch (operator) {
    case "eq":
      return normalizedActual === normalizedExpected;
    case "neq":
      return normalizedActual !== normalizedExpected;
    case "gt":
      return Number(normalizedActual) > Number(normalizedExpected);
    case "gte":
      return Number(normalizedActual) >= Number(normalizedExpected);
    case "lt":
      return Number(normalizedActual) < Number(normalizedExpected);
    case "lte":
      return Number(normalizedActual) <= Number(normalizedExpected);
    case "contains":
      return String(normalizedActual ?? "").includes(String(normalizedExpected ?? ""));
    case "exists":
      return !isBlankWorkflowValue(normalizedActual);
    default:
      return true;
  }
}

function workflowFieldVisibleByValues(field: WorkflowFormField, values: Record<string, unknown>) {
  const rule = workflowFieldVisibleWhen(field);
  if (!rule?.fieldCode || !rule.operator) {
    return true;
  }
  return compareWorkflowValue(values[rule.fieldCode], rule.operator, rule.compareValue);
}

function workflowCalculatedNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function calculateWorkflowFieldValue(field: WorkflowFormField, values: Record<string, unknown>) {
  const calculation = workflowFieldCalculation(field);
  if (!calculation || (field.type !== "NUMBER" && field.type !== "CURRENCY")) {
    return undefined;
  }
  const numbers = calculation.fieldCodes.map((code) => workflowCalculatedNumber(values[code]));
  if (numbers.length === 0 || numbers.some((value) => value === undefined)) {
    return undefined;
  }
  const safeNumbers = numbers as number[];
  if (calculation.operator === "SUM") return safeNumbers.reduce((sum, value) => sum + value, 0);
  if (calculation.operator === "DIFFERENCE") return safeNumbers.slice(1).reduce((result, value) => result - value, safeNumbers[0] ?? 0);
  if (calculation.operator === "PRODUCT") return safeNumbers.reduce((result, value) => result * value, 1);
  if (calculation.operator === "RATIO") return safeNumbers.slice(1).reduce((result, value) => (value === 0 ? Number.NaN : result / value), safeNumbers[0] ?? 0);
  return undefined;
}

function applyWorkflowCalculations(fields: WorkflowFormField[], values: Record<string, unknown>) {
  const next = { ...values };
  for (const field of fields) {
    const calculated = calculateWorkflowFieldValue(field, next);
    if (calculated !== undefined && Number.isFinite(calculated)) {
      next[field.code] = calculated;
    }
  }
  return next;
}

function shallowWorkflowValuesEqual(left: Record<string, unknown>, right: Record<string, unknown>) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (left[key] !== right[key]) return false;
  }
  return true;
}

function workflowVisibleRoleCodes(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];
}

function workflowEditableStepCodes(value: unknown) {
  if (Array.isArray(value)) {
    return workflowVisibleRoleCodes(value);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return workflowVisibleRoleCodes(record.stepCodes ?? record.steps ?? record.codes);
  }
  return [];
}

function workflowUserRoleCodes(roles: Array<{ code?: string } | string> | undefined) {
  return (roles ?? [])
    .map((role) => (typeof role === "string" ? role : role.code))
    .filter((code): code is string => typeof code === "string" && code.trim() !== "");
}

function workflowFieldVisibleForRoles(field: Pick<WorkflowFormField, "visibleToRoles">, roles: Array<{ code?: string } | string> | undefined) {
  const allowedRoleCodes = workflowVisibleRoleCodes(field.visibleToRoles);
  if (allowedRoleCodes.length === 0) {
    return true;
  }
  const userRoleCodes = workflowUserRoleCodes(roles);
  return allowedRoleCodes.some((roleCode) => userRoleCodes.includes(roleCode));
}

function filterWorkflowFieldsByRoles(fields: WorkflowFormField[], roles: Array<{ code?: string } | string> | undefined) {
  return fields.filter((field) => workflowFieldVisibleForRoles(field, roles));
}

function workflowFieldEditableForStep(field: Pick<WorkflowFormField, "editableBySteps">, stepCode?: string | null) {
  const editableStepCodes = workflowEditableStepCodes(field.editableBySteps);
  if (!stepCode || editableStepCodes.length === 0) {
    return true;
  }
  return editableStepCodes.includes(stepCode);
}

function buildWorkflowValuesFromData(fields: WorkflowFormField[], values: Record<string, unknown>) {
  return fields.reduce<Record<string, unknown>>((result, field) => {
    if (field.type !== "HEADING") {
      result[field.code] = Object.prototype.hasOwnProperty.call(values, field.code) ? values[field.code] : defaultFieldValue(field);
    }
    return result;
  }, {});
}

function parseOptionalWorkflowNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function workflowRuleNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function parseWorkflowFieldDefault(field: WorkflowFieldDraft): { value?: unknown; error?: string } {
  const raw = field.defaultValue.trim();
  if (!raw || field.type === "HEADING") {
    return {};
  }
  if (supportsNumberValidation(field.type)) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? { value: parsed } : { error: `Giá trị mặc định của ${field.name} phải là số hợp lệ.` };
  }
  if (field.type === "CHECKBOX") {
    const normalized = raw.toLowerCase();
    return { value: normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "co" || normalized === "có" };
  }
  return { value: raw };
}

function buildWorkflowFieldValidation(field: WorkflowFieldDraft): { validation?: WorkflowValidationRules; error?: string } {
  const validation: WorkflowValidationRules = {};

  if (supportsTextValidation(field.type)) {
    const minLength = parseOptionalWorkflowNumber(field.minLength);
    const maxLength = parseOptionalWorkflowNumber(field.maxLength);
    if (minLength === null || maxLength === null) {
      return { error: `Độ dài validation của ${field.name} phải là số hợp lệ.` };
    }
    if (minLength !== undefined) validation.minLength = Math.trunc(minLength);
    if (maxLength !== undefined) validation.maxLength = Math.trunc(maxLength);
    if (validation.minLength !== undefined && validation.maxLength !== undefined && validation.minLength > validation.maxLength) {
      return { error: `Độ dài tối thiểu của ${field.name} không được lớn hơn tối đa.` };
    }
  }

  if (supportsNumberValidation(field.type)) {
    const min = parseOptionalWorkflowNumber(field.minValue);
    const max = parseOptionalWorkflowNumber(field.maxValue);
    if (min === null || max === null) {
      return { error: `Giá trị validation của ${field.name} phải là số hợp lệ.` };
    }
    if (min !== undefined) validation.min = min;
    if (max !== undefined) validation.max = max;
    if (validation.min !== undefined && validation.max !== undefined && validation.min > validation.max) {
      return { error: `Giá trị tối thiểu của ${field.name} không được lớn hơn tối đa.` };
    }
  }

  if (supportsChoiceOptions(field.type) && field.catalogSourceCode.trim()) {
    validation.catalogSource = { catalogCode: field.catalogSourceCode.trim() };
  }

  if (supportsChoiceOptions(field.type) && !field.catalogSourceCode.trim()) {
    const options = parseWorkflowOptions(field.optionText);
    if (options.length === 0) {
      return { error: `${field.name} cần ít nhất một lựa chọn.` };
    }
    validation.options = options;
  }

  const columnSpan = parseOptionalWorkflowNumber(field.layoutColumnSpan);
  if (columnSpan === null || (columnSpan !== undefined && (columnSpan < 1 || columnSpan > 2))) {
    return { error: `Bố cục cột của ${field.name} chỉ nhận 1 hoặc 2.` };
  }
  const layout = {
    tab: field.layoutTab.trim() || undefined,
    section: field.layoutSection.trim() || undefined,
    columnSpan: columnSpan ? Math.trunc(columnSpan) : undefined
  };
  if (layout.tab || layout.section || layout.columnSpan) {
    validation.layout = layout;
  }

  if (field.visibleWhenFieldCode.trim()) {
    if (field.visibleWhenOperator !== "exists" && field.visibleWhenValue.trim() === "") {
      return { error: `Điều kiện hiển thị của ${field.name} cần giá trị so sánh.` };
    }
    validation.visibleWhen = {
      fieldCode: normalizeWorkflowCode(field.visibleWhenFieldCode),
      operator: field.visibleWhenOperator,
      compareValue: field.visibleWhenOperator === "exists" ? true : parseConditionValue(field.visibleWhenValue),
      groupType: "AND"
    };
  }

  if (field.calculationFieldCodes.trim()) {
    if (!supportsNumberValidation(field.type)) {
      return { error: `${field.name} chỉ được tính toán khi là trường số hoặc tiền tệ.` };
    }
    const fieldCodes = Array.from(
      new Set(
        field.calculationFieldCodes
          .split(/[\n,]/)
          .map((code) => normalizeWorkflowCode(code))
          .filter(Boolean)
      )
    );
    if (fieldCodes.length === 0) {
      return { error: `Công thức của ${field.name} cần ít nhất một trường nguồn.` };
    }
    validation.calculation = {
      operator: field.calculationOperator,
      fieldCodes
    };
  }

  if (field.type === "TABLE" && field.tableColumnsText.trim()) {
    const tableResult = parseWorkflowTableColumns(field.tableColumnsText);
    if (tableResult.error) {
      return { error: `${field.name}: ${tableResult.error}` };
    }
    if (tableResult.columns?.length) {
      validation.tableColumns = tableResult.columns;
    }
  }

  return Object.keys(validation).length > 0 ? { validation } : {};
}

const currencyFormatter = new Intl.NumberFormat("vi-VN");

function activeWorkflowVersion(template?: WorkflowTemplateDetail | null) {
  return template?.versions?.find((version) => version.status === "ACTIVE") ?? template?.versions?.[0] ?? null;
}

function defaultFieldValue(field: WorkflowFormField) {
  if (field.defaultValue !== undefined && field.defaultValue !== null) {
    return field.defaultValue;
  }
  if (field.type === "CHECKBOX") {
    return false;
  }
  return "";
}

function buildInitialWorkflowValues(fields: WorkflowFormField[]) {
  return fields.reduce<Record<string, unknown>>((values, field) => {
    if (field.type !== "HEADING") {
      values[field.code] = defaultFieldValue(field);
    }
    return values;
  }, {});
}

function groupWorkflowFieldsByLayout(fields: WorkflowFormField[]) {
  const tabMap = new Map<string, Map<string, WorkflowFormField[]>>();
  for (const field of fields) {
    const layout = workflowFieldLayout(field);
    const tab = layout.tab?.trim() || "Thong tin chung";
    const section = layout.section?.trim() || "Noi dung";
    if (!tabMap.has(tab)) {
      tabMap.set(tab, new Map());
    }
    const sectionMap = tabMap.get(tab)!;
    sectionMap.set(section, [...(sectionMap.get(section) ?? []), field]);
  }
  return [...tabMap.entries()].map(([tab, sectionMap]) => ({
    tab,
    sections: [...sectionMap.entries()].map(([section, sectionFields]) => ({ section, fields: sectionFields }))
  }));
}

function isBlankWorkflowValue(value: unknown) {
  return value === undefined || value === null || value === "";
}

function validateWorkflowValues(fields: WorkflowFormField[], values: Record<string, unknown>) {
  const effectiveValues = applyWorkflowCalculations(fields, values);
  return fields.reduce<Record<string, string>>((errors, field) => {
    if (field.type === "HEADING") {
      return errors;
    }
    if (!workflowFieldVisibleByValues(field, effectiveValues)) {
      return errors;
    }
    const value = effectiveValues[field.code];
    if (field.isRequired && isBlankWorkflowValue(value)) {
      errors[field.code] = "Trường này là bắt buộc.";
      return errors;
    }
    if (isBlankWorkflowValue(value)) {
      return errors;
    }
    if ((field.type === "NUMBER" || field.type === "CURRENCY") && !Number.isFinite(Number(value))) {
      errors[field.code] = "Vui lòng nhập số hợp lệ.";
    }
    if ((field.type === "DATE" || field.type === "DATETIME") && Number.isNaN(new Date(String(value)).getTime())) {
      errors[field.code] = "Vui lòng chọn ngày hợp lệ.";
    }
    if (supportsTextValidation(field.type)) {
      const minLength = workflowRuleNumber(field.validation?.minLength);
      const maxLength = workflowRuleNumber(field.validation?.maxLength);
      const textValue = String(value);
      if (minLength !== undefined && textValue.length < minLength) {
        errors[field.code] = `Vui lòng nhập tối thiểu ${minLength} ký tự.`;
      }
      if (maxLength !== undefined && textValue.length > maxLength) {
        errors[field.code] = `Vui lòng nhập tối đa ${maxLength} ký tự.`;
      }
    }
    if (supportsNumberValidation(field.type) && Number.isFinite(Number(value))) {
      const min = workflowRuleNumber(field.validation?.min);
      const max = workflowRuleNumber(field.validation?.max);
      const numericValue = Number(value);
      if (min !== undefined && numericValue < min) {
        errors[field.code] = `Giá trị phải lớn hơn hoặc bằng ${min}.`;
      }
      if (max !== undefined && numericValue > max) {
        errors[field.code] = `Giá trị phải nhỏ hơn hoặc bằng ${max}.`;
      }
    }
    if (supportsChoiceOptions(field.type)) {
      if (workflowCatalogSource(field)) {
        return errors;
      }
      const options = workflowFieldOptions(field);
      if (options.length > 0 && !options.includes(String(value))) {
        errors[field.code] = "Vui lòng chọn giá trị trong danh sách.";
      }
    }
    return errors;
  }, {});
}

function serializeWorkflowValues(fields: WorkflowFormField[], values: Record<string, unknown>) {
  return fields.reduce<Record<string, unknown>>((payload, field) => {
    if (field.type === "HEADING") {
      return payload;
    }
    const value = values[field.code];
    if (field.type === "CHECKBOX") {
      payload[field.code] = Boolean(value);
      return payload;
    }
    if (field.type === "NUMBER" || field.type === "CURRENCY") {
      payload[field.code] = isBlankWorkflowValue(value) ? null : Number(value);
      return payload;
    }
    payload[field.code] = typeof value === "string" ? value.trim() : value ?? null;
    return payload;
  }, {});
}

function displayWorkflowValue(field: WorkflowFormField, value: unknown) {
  if (field.type === "CHECKBOX") {
    return value ? "Có" : "Không";
  }
  if ((field.type === "NUMBER" || field.type === "CURRENCY") && typeof value === "number") {
    return field.type === "CURRENCY" ? `${currencyFormatter.format(value)} đ` : currencyFormatter.format(value);
  }
  if ((field.type === "DATE" || field.type === "DATETIME") && typeof value === "string" && value) {
    return formatDate(value);
  }
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }
  return String(value ?? "");
}

function formatWorkflowFileSize(bytes?: number) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function collectAllowedWorkflowAttachmentFiles(files: FileList | null) {
  const accepted: File[] = [];
  let error = "";
  if (!files) return { accepted, error };

  for (const file of Array.from(files)) {
    if (!allowedWorkflowAttachmentTypes.has(file.type)) {
      error = `Tệp ${file.name} không đúng định dạng cho phép.`;
      continue;
    }
    if (file.size > maxWorkflowAttachmentMb * 1024 * 1024) {
      error = `Tệp ${file.name} vượt quá ${maxWorkflowAttachmentMb} MB.`;
      continue;
    }
    accepted.push(file);
  }

  return { accepted, error };
}

function workflowTime(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function uniqueWorkflowNames(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function workflowApprovalLabel(approval: WorkflowApprovalSummary) {
  if (approval.action) return workflowActionHistoryLabels[approval.action] ?? approval.action;
  return workflowApprovalStatusLabels[approval.status] ?? approval.status;
}

function workflowStepModeLabel(step: WorkflowVersionStepSummary) {
  if (step.type === "END") return "Kết thúc quy trình";
  const mode = step.approvalMode === "PARALLEL" ? "Đồng thời" : "Tuần tự";
  if (step.completionRule === "ANY") return `${mode} · chỉ cần một người`;
  if (step.completionRule === "MIN_COUNT") return `${mode} · tối thiểu ${step.minCount ?? 1} người`;
  if (step.completionRule === "MIN_PERCENT") return `${mode} · tối thiểu ${step.minPercent ?? 1}%`;
  return `${mode} · tất cả cùng duyệt`;
}

function workflowDeadlineLabel(step: WorkflowVersionStepSummary, runtimeSteps: WorkflowInstanceStepSummary[]) {
  if (step.type === "END") return "Tự động khi hoàn tất";
  const activeDeadline = runtimeSteps
    .map((runtime) => runtime.deadlineAt)
    .filter(Boolean)
    .sort((left, right) => workflowTime(String(right)) - workflowTime(String(left)))[0];
  if (activeDeadline) return `Hạn bước: ${formatDate(String(activeDeadline))}`;
  if (!step.deadlineAmount) return "Chưa cấu hình hạn bước";
  return `SLA: ${step.deadlineAmount} ${step.deadlineUnit === "HOUR" ? "giờ" : "ngày"}`;
}

function describeWorkflowCondition(condition: { fieldCode: string; operator: string; compareValue: unknown }) {
  const operator = conditionOperatorOptions.find(([value]) => value === condition.operator)?.[1] ?? condition.operator;
  const compareValue = typeof condition.compareValue === "object" ? JSON.stringify(condition.compareValue) : String(condition.compareValue);
  return `${condition.fieldCode} ${operator} ${compareValue}`;
}

function describeWorkflowTransition(step: WorkflowVersionStepSummary, transitions: WorkflowTransitionSummary[]) {
  const outgoing = transitions.filter((transition) => transition.fromStepId === step.id || transition.fromStep?.id === step.id);
  if (outgoing.length === 0) return "";
  return outgoing
    .map((transition) => {
      const nextName = transition.toStep?.type === "END" ? "Kết thúc" : transition.toStep?.name ?? "Bước tiếp theo";
      const conditions = transition.conditions ?? [];
      if (conditions.length === 0) return `Sau bước này: ${nextName}`;
      return `Nếu ${conditions.map(describeWorkflowCondition).join(" và ")}: ${nextName}`;
    })
    .join(" · ");
}

function inferWorkflowTrackerState(
  instanceStatus: string,
  step: WorkflowVersionStepSummary,
  runtimeSteps: WorkflowInstanceStepSummary[],
  approvals: WorkflowApprovalSummary[],
  currentStepId?: string | null
): WorkflowTrackerState {
  if (approvals.some((approval) => approval.status === "REJECTED") || runtimeSteps.some((runtime) => runtime.status === "REJECTED")) {
    return "blocked";
  }
  if (
    instanceStatus === "NEEDS_INFO" &&
    approvals.some((approval) => approval.status === "REQUESTED_INFO" || approval.action === "REQUEST_INFO")
  ) {
    return "blocked";
  }
  if (runtimeSteps.some((runtime) => runtime.status === "RETURNED")) {
    return "blocked";
  }
  if (step.type === "END" && (instanceStatus === "APPROVED" || instanceStatus === "COMPLETED")) {
    return "done";
  }
  if (runtimeSteps.some((runtime) => runtime.status === "COMPLETED")) {
    return "done";
  }
  if (runtimeSteps.some((runtime) => runtime.status === "SKIPPED")) {
    return "skipped";
  }
  if (
    currentStepId === step.id ||
    runtimeSteps.some((runtime) => runtime.status === "PENDING" || runtime.status === "IN_PROGRESS") ||
    approvals.some((approval) => approval.status === "PENDING")
  ) {
    return "current";
  }
  return "upcoming";
}

function buildWorkflowTracker(instance: Record<string, any>): WorkflowTrackerNode[] {
  const runtimeSteps = ((instance.steps ?? []) as WorkflowInstanceStepSummary[]).slice().sort((left, right) => {
    return workflowTime(left.startedAt ?? left.createdAt) - workflowTime(right.startedAt ?? right.createdAt);
  });
  const plannedSteps = (((instance.workflowVersion?.steps ?? []) as WorkflowVersionStepSummary[]).length > 0
    ? ((instance.workflowVersion?.steps ?? []) as WorkflowVersionStepSummary[])
    : runtimeSteps.map((runtime) => runtime.step).filter(Boolean)
  ) as WorkflowVersionStepSummary[];
  const transitions = ((instance.workflowVersion?.transitions ?? []) as WorkflowTransitionSummary[]).slice();
  const currentStepId = instance.currentStep?.id ?? instance.currentStepId ?? null;

  return plannedSteps
    .filter((step) => step.type !== "START")
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((step) => {
      const matchingRuntimeSteps = runtimeSteps.filter((runtime) => runtime.stepId === step.id || runtime.step?.id === step.id);
      const approvals = matchingRuntimeSteps
        .flatMap((runtime) => runtime.approvals ?? [])
        .sort((left, right) => workflowTime(left.actedAt ?? left.createdAt) - workflowTime(right.actedAt ?? right.createdAt));
      const pendingApprovers = uniqueWorkflowNames(
        approvals.filter((approval) => approval.status === "PENDING").map((approval) => approval.approver?.fullName ?? "")
      );
      const completedApprovers = uniqueWorkflowNames(
        approvals
          .filter((approval) => approval.status !== "PENDING")
          .map((approval) => [approval.approver?.fullName, workflowApprovalLabel(approval)].filter(Boolean).join(" - "))
      );

      return {
        step,
        runtimeSteps: matchingRuntimeSteps,
        approvals,
        state: inferWorkflowTrackerState(instance.status, step, matchingRuntimeSteps, approvals, currentStepId),
        pendingApprovers,
        completedApprovers,
        transitionLabel: describeWorkflowTransition(step, transitions)
      };
    });
}

function WorkflowTrackerIcon({ state }: { state: WorkflowTrackerState }) {
  if (state === "done") return <CheckCircle2 size={18} />;
  if (state === "blocked") return <XCircle size={18} />;
  if (state === "skipped") return <RotateCcw size={18} />;
  if (state === "current") return <Clock3 size={18} />;
  return <CircleDot size={18} />;
}

function optionLabel(options: readonly (readonly [string, string])[], value: string) {
  return options.find(([optionValue]) => optionValue === value)?.[1] ?? value;
}

function workflowPreviewValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function workflowFieldValidationPreview(field: WorkflowFieldDraft) {
  const validationResult = buildWorkflowFieldValidation(field);
  if (validationResult.error) return `Validation lỗi: ${validationResult.error}`;
  const validation = validationResult.validation ?? {};
  const rules = [
    validation.minLength !== undefined ? `Tối thiểu ${validation.minLength} ký tự` : "",
    validation.maxLength !== undefined ? `Tối đa ${validation.maxLength} ký tự` : "",
    validation.min !== undefined ? `Tối thiểu ${validation.min}` : "",
    validation.max !== undefined ? `Tối đa ${validation.max}` : "",
    validation.options?.length ? `Lựa chọn: ${validation.options.join(", ")}` : ""
  ].filter(Boolean);
  if (validation.layout?.tab || validation.layout?.section) {
    rules.push(`Layout: ${[validation.layout.tab, validation.layout.section].filter(Boolean).join(" / ")}`);
  }
  if (validation.layout?.columnSpan === 2) {
    rules.push("Rộng 2 cột");
  }
  if (validation.visibleWhen) {
    rules.push(
      `Hiện khi ${validation.visibleWhen.fieldCode} ${optionLabel(conditionOperatorOptions, validation.visibleWhen.operator).toLowerCase()} ${
        validation.visibleWhen.operator === "exists" ? "có dữ liệu" : workflowPreviewValue(validation.visibleWhen.compareValue)
      }`
    );
  }
  if (validation.calculation) {
    rules.push(`Tính ${validation.calculation.operator}: ${validation.calculation.fieldCodes.join(", ")}`);
  }
  if (validation.catalogSource) {
    rules.push(`Nguon danh muc: ${validation.catalogSource.catalogCode}`);
  }
  if (validation.tableColumns?.length) {
    rules.push(`Bảng ${validation.tableColumns.length} cột`);
  }
  return rules.length > 0 ? rules.join(" · ") : "Không có rule bổ sung";
}

function workflowStepCompletionPreview(step: WorkflowApprovalStepDraft) {
  const mode = step.approvalMode === "PARALLEL" ? "Đồng thời" : "Tuần tự";
  if (step.completionRule === "ANY") return `${mode} · một người duyệt`;
  if (step.completionRule === "MIN_COUNT") return `${mode} · tối thiểu ${step.minCount} người`;
  if (step.completionRule === "MIN_PERCENT") return `${mode} · tối thiểu ${step.minPercent}%`;
  return `${mode} · tất cả cùng duyệt`;
}

function workflowSetting(settings: Record<string, any>[] | null | undefined, key: string) {
  return settings?.find((setting) => setting.key === key)?.value;
}

function workflowNumberSetting(settings: Record<string, any>[] | null | undefined, key: string, fallback: number) {
  const value = workflowSetting(settings, key);
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function workflowStringSetting(settings: Record<string, any>[] | null | undefined, key: string, fallback: string, allowed: string[]) {
  const value = String(workflowSetting(settings, key) ?? fallback);
  return allowed.includes(value) ? value : fallback;
}

function workflowBooleanSetting(settings: Record<string, any>[] | null | undefined, key: string, fallback: boolean) {
  const value = workflowSetting(settings, key);
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return fallback;
}

function workflowBuilderDefaults(settings: Record<string, any>[] | null | undefined) {
  const completionRule = workflowStringSetting(settings, "workflow.step.default_completion_rule", "ALL", [
    "ALL",
    "ANY",
    "MIN_COUNT",
    "MIN_PERCENT"
  ]);
  return {
    autoActivateTemplate: workflowBooleanSetting(settings, "workflow.template.auto_activate", true),
    deadlineAmount: Math.max(0, Math.floor(workflowNumberSetting(settings, "workflow.step.default_deadline_amount", 1))),
    deadlineUnit: workflowStringSetting(settings, "workflow.step.default_deadline_unit", "DAY", ["HOUR", "DAY"]),
    reminderBeforeHours: Math.max(0, Math.floor(workflowNumberSetting(settings, "workflow.step.default_reminder_before_hours", 24))),
    approvalMode: workflowStringSetting(settings, "workflow.step.default_approval_mode", "SEQUENTIAL", ["SEQUENTIAL", "PARALLEL"]),
    completionRule
  };
}

function applyWorkflowStepDefaults(step: WorkflowApprovalStepDraft, defaults: ReturnType<typeof workflowBuilderDefaults>) {
  return {
    ...step,
    approvalMode: defaults.approvalMode,
    completionRule: defaults.completionRule,
    deadlineAmount: defaults.deadlineAmount,
    deadlineUnit: defaults.deadlineUnit,
    reminderBeforeHours: defaults.reminderBeforeHours,
    minCount: defaults.completionRule === "MIN_COUNT" ? Math.max(1, step.minCount) : step.minCount,
    minPercent: defaults.completionRule === "MIN_PERCENT" ? Math.max(1, step.minPercent) : step.minPercent
  };
}

export function WorkflowBuilder({ setPage }: WorkflowPageProps) {
  const workflowSettings = useAsyncData<Record<string, any>[]>(() => api.settings().catch(() => []), []);
  const roles = useAsyncData<RoleSummary[]>(() => api.roles() as Promise<RoleSummary[]>, []);
  const users = useAsyncData(() => api.users(), []);
  const sharedCatalogs = useAsyncData<Record<string, any>[]>(() => api.sharedCatalogs().catch(() => []), []);
  const [form, setForm] = useState({
    code: "",
    name: "",
    category: "",
    managerId: "",
    description: "",
    starterRoleCodes: [] as string[]
  });
  const [fields, setFields] = useState<WorkflowFieldDraft[]>([newWorkflowField(1), newWorkflowField(2)]);
  const [approvalSteps, setApprovalSteps] = useState<WorkflowApprovalStepDraft[]>([newApprovalStep(1)]);
  const [selectedDesignerStepId, setSelectedDesignerStepId] = useState("");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [workflowDefaultsApplied, setWorkflowDefaultsApplied] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const defaults = workflowBuilderDefaults(workflowSettings.data);
  const roleNameByCode = useMemo(() => new Map((roles.data ?? []).map((role) => [role.code, role.name])), [roles.data]);
  const userOptions = users.data?.data ?? [];
  const sharedCatalogOptions = sharedCatalogs.data ?? [];

  useEffect(() => {
    if (workflowDefaultsApplied || !workflowSettings.data) return;
    setApprovalSteps((current) =>
      current.map((step) => {
        const stillUsingInitialDefaults =
          step.approvalMode === "SEQUENTIAL" &&
          step.completionRule === "ALL" &&
          step.deadlineAmount === 1 &&
          step.deadlineUnit === "DAY" &&
          step.reminderBeforeHours === 24;
        return stillUsingInitialDefaults ? applyWorkflowStepDefaults(step, defaults) : step;
      })
    );
    setWorkflowDefaultsApplied(true);
  }, [defaults, workflowDefaultsApplied, workflowSettings.data]);

  useEffect(() => {
    if (approvalSteps.length === 0) {
      setSelectedDesignerStepId("");
      return;
    }
    if (!selectedDesignerStepId || !approvalSteps.some((step) => step.id === selectedDesignerStepId)) {
      setSelectedDesignerStepId(approvalSteps[0]?.id ?? "");
    }
  }, [approvalSteps, selectedDesignerStepId]);

  function updateField(id: string, patch: Partial<WorkflowFieldDraft>) {
    setFields((current) => current.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  }

  function toggleFieldVisibleRole(id: string, roleCode: string, checked: boolean) {
    setFields((current) =>
      current.map((field) => {
        if (field.id !== id) return field;
        const visibleRoleCodes = new Set(field.visibleRoleCodes);
        if (checked) {
          visibleRoleCodes.add(roleCode);
        } else {
          visibleRoleCodes.delete(roleCode);
        }
        return { ...field, visibleRoleCodes: [...visibleRoleCodes] };
      })
    );
  }

  function toggleFieldEditableStep(id: string, stepCode: string, checked: boolean) {
    setFields((current) =>
      current.map((field) => {
        if (field.id !== id) return field;
        const editableStepCodes = new Set(field.editableStepCodes);
        if (checked) {
          editableStepCodes.add(stepCode);
        } else {
          editableStepCodes.delete(stepCode);
        }
        return { ...field, editableStepCodes: [...editableStepCodes] };
      })
    );
  }

  function toggleStarterRole(roleCode: string, checked: boolean) {
    setForm((current) => {
      const starterRoleCodes = new Set(current.starterRoleCodes);
      if (checked) {
        starterRoleCodes.add(roleCode);
      } else {
        starterRoleCodes.delete(roleCode);
      }
      return { ...current, starterRoleCodes: [...starterRoleCodes] };
    });
  }

  function updateStep(id: string, patch: Partial<WorkflowApprovalStepDraft>) {
    setApprovalSteps((current) => current.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  }

  function appendApprovalSteps(count: number, patch: Partial<WorkflowApprovalStepDraft> = {}) {
    const safeCount = Math.max(1, Math.min(100, count));
    const nextSteps = Array.from({ length: safeCount }, (_, offset) => {
      const nextStep = applyWorkflowStepDefaults(newApprovalStep(approvalSteps.length + offset + 1), defaults);
      return { ...nextStep, ...patch };
    });
    setApprovalSteps((current) => [...current, ...nextSteps]);
    setSelectedDesignerStepId(nextSteps[0]?.id ?? "");
  }

  function appendApprovalStep(patch: Partial<WorkflowApprovalStepDraft> = {}) {
    appendApprovalSteps(1, patch);
  }

  function removeApprovalStep(id: string) {
    setApprovalSteps((current) => current.filter((step) => step.id !== id));
  }

  function moveApprovalStep(sourceId: string, targetId: string) {
    if (!sourceId || sourceId === targetId) return;
    setApprovalSteps((current) => {
      const sourceIndex = current.findIndex((step) => step.id === sourceId);
      const targetIndex = current.findIndex((step) => step.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      if (!moved) return current;
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setSelectedDesignerStepId(sourceId);
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
    const stepCodeSet = new Set(stepCodes);
    const invalidEditableStep = fields.find((field) => field.editableStepCodes.some((stepCode) => !stepCodeSet.has(stepCode)));
    if (invalidEditableStep) return `Truong ${invalidEditableStep.name} chon buoc duoc sua khong hop le.`;
    for (const field of fields) {
      const defaultResult = parseWorkflowFieldDefault(field);
      if (defaultResult.error) return defaultResult.error;
      const validationResult = buildWorkflowFieldValidation(field);
      if (validationResult.error) return validationResult.error;
      const normalizedCode = normalizeWorkflowCode(field.code);
      const visibleFieldCode = validationResult.validation?.visibleWhen?.fieldCode;
      if (visibleFieldCode && (!fieldCodes.includes(visibleFieldCode) || visibleFieldCode === normalizedCode)) {
        return `Điều kiện hiển thị của ${field.name} tham chiếu trường không hợp lệ.`;
      }
      const invalidCalculatedFieldCode = validationResult.validation?.calculation?.fieldCodes.find((fieldCode) => !fieldCodes.includes(fieldCode) || fieldCode === normalizedCode);
      if (invalidCalculatedFieldCode) {
        return `Công thức của ${field.name} tham chiếu trường không hợp lệ.`;
      }
      if (
        supportsChoiceOptions(field.type) &&
        defaultResult.value !== undefined &&
        validationResult.validation?.options &&
        !validationResult.validation.options.includes(String(defaultResult.value))
      ) {
        return `Giá trị mặc định của ${field.name} phải nằm trong danh sách lựa chọn.`;
      }
    }
    const invalidMinRule = approvalSteps.find(
      (step) =>
        (step.completionRule === "MIN_COUNT" && (!Number.isInteger(step.minCount) || step.minCount < 1)) ||
        (step.completionRule === "MIN_PERCENT" && (!Number.isInteger(step.minPercent) || step.minPercent < 1 || step.minPercent > 100))
    );
    if (invalidMinRule) return "Điều kiện hoàn thành tối thiểu cần giá trị hợp lệ.";
    const invalidCondition = approvalSteps.slice(0, -1).find((step) => {
      if (!step.conditionalNext) return false;
      return !fieldCodes.includes(normalizeWorkflowCode(step.conditionFieldCode)) || (step.conditionOperator !== "exists" && step.conditionValue.trim() === "");
    });
    if (invalidCondition) return "Điều kiện chuyển bước cần chọn trường hợp lệ và giá trị so sánh.";
    return "";
  }

  const editableStepOptions = approvalSteps
    .map((step, index) => ({
      code: normalizeWorkflowCode(step.code),
      label: step.name.trim() || `Buoc duyet ${index + 1}`
    }))
    .filter((step) => step.code);
  const editableStepNameByCode = new Map(editableStepOptions.map((step) => [step.code, step.label]));

  const previewFields = fields.map((field, index) => {
    const defaultResult = parseWorkflowFieldDefault(field);
    return {
      id: field.id,
      order: index + 1,
      name: field.name.trim() || `Trường ${index + 1}`,
      code: normalizeWorkflowCode(field.code) || "field_code",
      typeLabel: optionLabel(fieldTypeOptions, field.type),
      requiredLabel: field.isRequired ? "Bắt buộc" : "Không bắt buộc",
      defaultLabel: defaultResult.error ? `Mặc định lỗi: ${defaultResult.error}` : workflowPreviewValue(defaultResult.value),
      validationLabel: workflowFieldValidationPreview(field),
      roleLabel:
        field.visibleRoleCodes.length > 0
          ? field.visibleRoleCodes.map((roleCode) => roleNameByCode.get(roleCode) ?? roleCode).join(", ")
          : "Tất cả vai trò",
      editableLabel:
        field.editableStepCodes.length > 0
          ? field.editableStepCodes.map((stepCode) => editableStepNameByCode.get(stepCode) ?? stepCode).join(", ")
          : "Tat ca buoc bo sung",
      placeholder: field.placeholder.trim()
    };
  });
  const starterRoleLabel =
    form.starterRoleCodes.length > 0
      ? form.starterRoleCodes.map((roleCode) => roleNameByCode.get(roleCode) ?? roleCode).join(", ")
      : "Tất cả người có quyền tạo hồ sơ";
  const managerName = userOptions.find((user: Record<string, any>) => user.id === form.managerId)?.fullName ?? "Chưa chọn";
  const selectedDesignerStep = approvalSteps.find((step) => step.id === selectedDesignerStepId) ?? approvalSteps[0];
  const selectedDesignerStepIndex = selectedDesignerStep ? approvalSteps.findIndex((step) => step.id === selectedDesignerStep.id) : -1;

  const previewSteps = approvalSteps.map((step, index) => {
    const nextStep = approvalSteps[index + 1];
    const nextLabel = nextStep ? nextStep.name.trim() || `Bước ${index + 2}` : "Kết thúc";
    const conditionField = fields.find((field) => normalizeWorkflowCode(field.code) === normalizeWorkflowCode(step.conditionFieldCode));
    const conditionLabel = step.conditionalNext
      ? `Nếu ${conditionField?.name ?? step.conditionFieldCode} ${optionLabel(conditionOperatorOptions, step.conditionOperator).toLowerCase()} ${
          step.conditionOperator === "exists" ? "có dữ liệu" : step.conditionValue || "..."
        } thì chuyển ${nextLabel}`
      : `Sau khi hoàn tất chuyển ${nextLabel}`;

    return {
      id: step.id,
      order: index + 1,
      name: step.name.trim() || `Bước duyệt ${index + 1}`,
      code: normalizeWorkflowCode(step.code) || "step_code",
      resolverLabel: optionLabel(resolverTypeOptions, step.resolverType),
      completionLabel: workflowStepCompletionPreview(step),
      deadlineLabel: step.deadlineAmount > 0 ? `${step.deadlineAmount} ${step.deadlineUnit === "HOUR" ? "giờ" : "ngày"}` : "Không đặt hạn",
      reminderLabel: step.reminderBeforeHours > 0 ? `Nhắc trước ${step.reminderBeforeHours} giờ` : "Không nhắc trước hạn",
      conditionLabel
    };
  });

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
      const transitions = normalizedSteps.map((step, index) => {
        const nextStepCode = normalizedSteps[index + 1]?.code ?? "end";
        return {
          fromStepCode: step.code,
          toStepCode: nextStepCode,
          priority: index + 1,
          conditions:
            step.conditionalNext && nextStepCode !== "end"
              ? [
                  {
                    fieldCode: normalizeWorkflowCode(step.conditionFieldCode),
                    operator: step.conditionOperator,
                    compareValue: step.conditionOperator === "exists" ? true : parseConditionValue(step.conditionValue),
                    groupType: "AND"
                  }
                ]
              : []
        };
      });
      await api.createWorkflowTemplate({
        code: form.code.trim(),
        name: form.name.trim(),
        category: form.category.trim() || undefined,
        description: form.description.trim() || undefined,
        managerId: form.managerId || undefined,
        activate: defaults.autoActivateTemplate,
        allowedStarters: form.starterRoleCodes.length > 0 ? { roleCodes: form.starterRoleCodes } : undefined,
        fields: fields.map((field, index) => {
          const defaultResult = parseWorkflowFieldDefault(field);
          const validationResult = buildWorkflowFieldValidation(field);
          return {
            name: field.name.trim(),
            code: normalizeWorkflowCode(field.code),
            type: field.type,
            isRequired: field.isRequired,
            defaultValue: defaultResult.value,
            placeholder: field.placeholder.trim() || undefined,
            validation: validationResult.validation,
            editableBySteps: field.editableStepCodes.length > 0 ? field.editableStepCodes : undefined,
            visibleToRoles: field.visibleRoleCodes.length > 0 ? field.visibleRoleCodes : undefined,
            displayOrder: index + 1
          };
        }),
        steps: [
          { code: "start", name: "Bắt đầu", type: "START", orderIndex: 1 },
          ...normalizedSteps.map((step) => ({
            code: step.code,
            name: step.name.trim(),
            type: "APPROVAL",
            orderIndex: step.orderIndex,
            approvalMode: step.approvalMode,
            completionRule: step.completionRule,
            minCount: step.completionRule === "MIN_COUNT" ? step.minCount : undefined,
            minPercent: step.completionRule === "MIN_PERCENT" ? step.minPercent : undefined,
            deadlineAmount: step.deadlineAmount || undefined,
            deadlineUnit: step.deadlineUnit,
            reminderBeforeHours: step.reminderBeforeHours,
            assignees: [{ resolverType: step.resolverType, orderIndex: 1 }]
          })),
          { code: "end", name: "Kết thúc", type: "END", orderIndex: normalizedSteps.length + 2 }
        ],
        transitions
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
          {"Người quản lý quy trình"}
          <select data-testid="workflow-template-manager" value={form.managerId} onChange={(event) => setForm({ ...form, managerId: event.target.value })}>
            <option value="">{"Chưa chọn"}</option>
            {userOptions.map((user: Record<string, any>) => (
              <option key={user.id} value={user.id}>
                {user.fullName}
              </option>
            ))}
          </select>
        </label>
        <label>
          {"Mô tả"}
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </label>
        <div className="workflow-template-starters">
          <span>{"Vai trò được khởi tạo hồ sơ"}</span>
          <div className="workflow-field-role-options">
            {roles.loading && <small>{"Đang tải vai trò..."}</small>}
            {!roles.loading &&
              (roles.data ?? []).map((role) => (
                <label className="toggle-line compact-toggle" key={role.code}>
                  <input
                    data-testid={`workflow-template-starter-role-${role.code}`}
                    type="checkbox"
                    checked={form.starterRoleCodes.includes(role.code)}
                    onChange={(event) => toggleStarterRole(role.code, event.target.checked)}
                  />
                  {role.name}
                </label>
              ))}
          </div>
          <small>{"Để trống nghĩa là mọi người có quyền tạo hồ sơ đều được dùng mẫu này."}</small>
        </div>
      </fieldset>
      <fieldset className="workflow-designer full" data-testid="workflow-designer">
        <legend>Designer quy trình</legend>
        <div className="workflow-designer-layout">
          <section className="workflow-palette" data-testid="workflow-designer-palette">
            <div className="workflow-palette-head">
              <h3>Node</h3>
              <span className="status-chip">{approvalSteps.length} node</span>
            </div>
            <button className="ghost-button compact" type="button" onClick={() => appendApprovalStep({ resolverType: "REQUESTER_MANAGER" })}>
              <CircleDot size={16} />
              Quản lý duyệt
            </button>
            <button className="ghost-button compact" type="button" onClick={() => appendApprovalStep({ resolverType: "REQUESTER_DEPARTMENT_HEAD" })}>
              <GitBranch size={16} />
              Trưởng phòng duyệt
            </button>
            <button className="ghost-button compact" type="button" onClick={() => appendApprovalStep({ resolverType: "PREVIOUS_STEP_ASSIGNEE" })}>
              <Plus size={16} />
              Người xử lý trước
            </button>
            <button className="ghost-button compact" data-testid="workflow-designer-add-10" type="button" onClick={() => appendApprovalSteps(10)}>
              <Plus size={16} />
              Thêm 10 bước
            </button>
          </section>
          <section className={`workflow-canvas ${approvalSteps.length >= 30 ? "compact" : ""}`} data-testid="workflow-designer-canvas" aria-label="Canvas quy trình">
            <div className="workflow-canvas-terminal start">
              <span>Bắt đầu</span>
            </div>
            {approvalSteps.map((step, index) => (
              <button
                className={`workflow-canvas-node ${selectedDesignerStep?.id === step.id ? "active" : ""}`}
                data-testid={`workflow-designer-node-${index}`}
                draggable
                key={step.id}
                type="button"
                onClick={() => setSelectedDesignerStepId(step.id)}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", step.id);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  moveApprovalStep(event.dataTransfer.getData("text/plain"), step.id);
                }}
              >
                <span className="workflow-node-index">{index + 1}</span>
                <span className="workflow-node-main">
                  <strong>{step.name.trim() || `Bước duyệt ${index + 1}`}</strong>
                  <small>
                    {normalizeWorkflowCode(step.code) || "step_code"} · {optionLabel(resolverTypeOptions, step.resolverType)}
                  </small>
                </span>
                <span className="status-chip">{step.approvalMode === "PARALLEL" ? "Đồng thời" : "Tuần tự"}</span>
              </button>
            ))}
            <div className="workflow-canvas-terminal end">
              <CheckCircle2 size={16} />
              <span>Kết thúc</span>
            </div>
          </section>
          <section className="workflow-node-config" data-testid="workflow-node-config">
            <h3>Cấu hình node</h3>
            {selectedDesignerStep ? (
              <>
                <label>
                  Tên bước
                  <input
                    data-testid="workflow-designer-step-name"
                    value={selectedDesignerStep.name}
                    onChange={(event) => updateStep(selectedDesignerStep.id, { name: event.target.value })}
                  />
                </label>
                <label>
                  Mã bước
                  <input
                    data-testid="workflow-designer-step-code"
                    value={selectedDesignerStep.code}
                    onChange={(event) => updateStep(selectedDesignerStep.id, { code: event.target.value })}
                  />
                </label>
                <label>
                  Người xử lý
                  <select
                    data-testid="workflow-designer-step-resolver"
                    value={selectedDesignerStep.resolverType}
                    onChange={(event) => updateStep(selectedDesignerStep.id, { resolverType: event.target.value })}
                  >
                    {resolverTypeOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Cơ chế duyệt
                  <select
                    data-testid="workflow-designer-step-mode"
                    value={selectedDesignerStep.approvalMode}
                    onChange={(event) => updateStep(selectedDesignerStep.id, { approvalMode: event.target.value })}
                  >
                    <option value="SEQUENTIAL">Tuần tự</option>
                    <option value="PARALLEL">Đồng thời</option>
                  </select>
                </label>
                <label>
                  Hạn xử lý
                  <span className="inline-fields">
                    <input
                      data-testid="workflow-designer-step-deadline"
                      min={0}
                      type="number"
                      value={selectedDesignerStep.deadlineAmount}
                      onChange={(event) => updateStep(selectedDesignerStep.id, { deadlineAmount: Number(event.target.value) })}
                    />
                    <select
                      data-testid="workflow-designer-step-deadline-unit"
                      value={selectedDesignerStep.deadlineUnit}
                      onChange={(event) => updateStep(selectedDesignerStep.id, { deadlineUnit: event.target.value })}
                    >
                      <option value="HOUR">Giờ</option>
                      <option value="DAY">Ngày</option>
                    </select>
                  </span>
                </label>
                <div className="form-actions">
                  <button
                    className="ghost-button compact"
                    type="button"
                    disabled={selectedDesignerStepIndex <= 0}
                    onClick={() => moveApprovalStep(selectedDesignerStep.id, approvalSteps[selectedDesignerStepIndex - 1]?.id ?? selectedDesignerStep.id)}
                  >
                    Lên
                  </button>
                  <button
                    className="ghost-button compact"
                    type="button"
                    disabled={selectedDesignerStepIndex < 0 || selectedDesignerStepIndex >= approvalSteps.length - 1}
                    onClick={() => moveApprovalStep(selectedDesignerStep.id, approvalSteps[selectedDesignerStepIndex + 1]?.id ?? selectedDesignerStep.id)}
                  >
                    Xuống
                  </button>
                  <button className="ghost-button compact" type="button" disabled={approvalSteps.length <= 1} onClick={() => removeApprovalStep(selectedDesignerStep.id)}>
                    Xóa node
                  </button>
                </div>
              </>
            ) : (
              <p className="empty-text">Chưa có bước phê duyệt.</p>
            )}
          </section>
        </div>
      </fieldset>
      <fieldset className="builder-list">
        <legend>{"Biểu mẫu"}</legend>
        {fields.map((field, index) => (
          <div className="builder-row workflow-field-row" key={field.id}>
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
            <select data-testid={"workflow-field-type-" + index} value={field.type} onChange={(event) => updateField(field.id, { type: event.target.value })}>
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
            <div className="workflow-field-rules">
              <label>
                {"Giá trị mặc định"}
                <input data-testid={"workflow-field-default-" + index} value={field.defaultValue} onChange={(event) => updateField(field.id, { defaultValue: event.target.value })} />
              </label>
              <label>
                {"Lựa chọn"}
                <input
                  data-testid={"workflow-field-options-" + index}
                  placeholder="Noi bo, Khach hang"
                  value={field.optionText}
                  disabled={!supportsChoiceOptions(field.type)}
                  onChange={(event) => updateField(field.id, { optionText: event.target.value })}
                />
              </label>
              <label>
                Nguon danh muc
                <select
                  data-testid={"workflow-field-catalog-source-" + index}
                  value={field.catalogSourceCode}
                  disabled={!supportsChoiceOptions(field.type)}
                  onChange={(event) => updateField(field.id, { catalogSourceCode: event.target.value })}
                >
                  <option value="">Khong dung</option>
                  {sharedCatalogOptions.map((catalog) => (
                    <option key={catalog.id ?? catalog.code} value={catalog.code}>
                      {catalog.name} ({catalog.code})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {"Ký tự tối thiểu"}
                <input
                  data-testid={"workflow-field-min-length-" + index}
                  type="number"
                  min={0}
                  value={field.minLength}
                  disabled={!supportsTextValidation(field.type)}
                  onChange={(event) => updateField(field.id, { minLength: event.target.value })}
                />
              </label>
              <label>
                {"Ký tự tối đa"}
                <input
                  data-testid={"workflow-field-max-length-" + index}
                  type="number"
                  min={1}
                  value={field.maxLength}
                  disabled={!supportsTextValidation(field.type)}
                  onChange={(event) => updateField(field.id, { maxLength: event.target.value })}
                />
              </label>
              <label>
                {"Giá trị tối thiểu"}
                <input
                  data-testid={"workflow-field-min-value-" + index}
                  type="number"
                  value={field.minValue}
                  disabled={!supportsNumberValidation(field.type)}
                  onChange={(event) => updateField(field.id, { minValue: event.target.value })}
                />
              </label>
              <label>
                {"Giá trị tối đa"}
                <input
                  data-testid={"workflow-field-max-value-" + index}
                  type="number"
                  value={field.maxValue}
                  disabled={!supportsNumberValidation(field.type)}
                  onChange={(event) => updateField(field.id, { maxValue: event.target.value })}
                />
              </label>
              <div className="workflow-field-advanced" data-testid={"workflow-field-layout-" + index}>
                <span>Bo cuc hien thi</span>
                <label>
                  Tab
                  <input value={field.layoutTab} onChange={(event) => updateField(field.id, { layoutTab: event.target.value })} />
                </label>
                <label>
                  Section
                  <input value={field.layoutSection} onChange={(event) => updateField(field.id, { layoutSection: event.target.value })} />
                </label>
                <label>
                  So cot
                  <select value={field.layoutColumnSpan} onChange={(event) => updateField(field.id, { layoutColumnSpan: event.target.value })}>
                    <option value="1">1 cot</option>
                    <option value="2">2 cot</option>
                  </select>
                </label>
              </div>
              <div className="workflow-field-advanced" data-testid={"workflow-field-visible-when-" + index}>
                <span>Dieu kien hien thi</span>
                <label>
                  Truong dieu kien
                  <select value={field.visibleWhenFieldCode} onChange={(event) => updateField(field.id, { visibleWhenFieldCode: event.target.value })}>
                    <option value="">Luon hien</option>
                    {fields
                      .filter((candidate) => candidate.id !== field.id)
                      .map((candidate) => (
                        <option key={candidate.id} value={normalizeWorkflowCode(candidate.code)}>
                          {candidate.name || candidate.code}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Toan tu
                  <select
                    value={field.visibleWhenOperator}
                    disabled={!field.visibleWhenFieldCode}
                    onChange={(event) => updateField(field.id, { visibleWhenOperator: event.target.value })}
                  >
                    {conditionOperatorOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Gia tri
                  <input
                    value={field.visibleWhenValue}
                    disabled={!field.visibleWhenFieldCode || field.visibleWhenOperator === "exists"}
                    onChange={(event) => updateField(field.id, { visibleWhenValue: event.target.value })}
                  />
                </label>
              </div>
              <div className="workflow-field-advanced" data-testid={"workflow-field-calculation-" + index}>
                <span>Tinh toan / bang lap</span>
                <label>
                  Cong thuc
                  <select
                    value={field.calculationOperator}
                    disabled={!supportsNumberValidation(field.type)}
                    onChange={(event) => updateField(field.id, { calculationOperator: event.target.value })}
                  >
                    <option value="SUM">Cong</option>
                    <option value="DIFFERENCE">Tru</option>
                    <option value="PRODUCT">Nhan</option>
                    <option value="RATIO">Chia</option>
                  </select>
                </label>
                <label>
                  Truong nguon
                  <input
                    placeholder="amount, tax"
                    value={field.calculationFieldCodes}
                    disabled={!supportsNumberValidation(field.type)}
                    onChange={(event) => updateField(field.id, { calculationFieldCodes: event.target.value })}
                  />
                </label>
                <label className="workflow-table-columns">
                  Cot bang
                  <textarea
                    placeholder={"item|Hang muc|SHORT_TEXT|required\nqty|So luong|NUMBER"}
                    rows={3}
                    value={field.tableColumnsText}
                    disabled={field.type !== "TABLE"}
                    onChange={(event) => updateField(field.id, { tableColumnsText: event.target.value })}
                  />
                </label>
              </div>
              <div className="workflow-field-visibility" data-testid={"workflow-field-editable-steps-" + index}>
                <span>{"Buoc duoc sua khi bo sung"}</span>
                <div className="workflow-field-role-options">
                  {editableStepOptions.map((step) => (
                    <label className="toggle-line compact-toggle" key={step.code}>
                      <input
                        data-testid={`workflow-field-editable-step-${index}-${step.code}`}
                        type="checkbox"
                        checked={field.editableStepCodes.includes(step.code)}
                        onChange={(event) => toggleFieldEditableStep(field.id, step.code, event.target.checked)}
                      />
                      {step.label}
                    </label>
                  ))}
                </div>
                <small>{"De trong nghia la requester co the sua truong nay o moi buoc bo sung."}</small>
              </div>
              <div className="workflow-field-visibility" data-testid={"workflow-field-visible-roles-" + index}>
                <span>{"Vai trò được xem trường"}</span>
                <div className="workflow-field-role-options">
                  {roles.loading && <small>{"Đang tải vai trò..."}</small>}
                  {!roles.loading &&
                    (roles.data ?? []).map((role) => (
                      <label className="toggle-line compact-toggle" key={role.code}>
                        <input
                          data-testid={`workflow-field-visible-role-${index}-${role.code}`}
                          type="checkbox"
                          checked={field.visibleRoleCodes.includes(role.code)}
                          onChange={(event) => toggleFieldVisibleRole(field.id, role.code, event.target.checked)}
                        />
                        {role.name}
                      </label>
                    ))}
                </div>
                <small>{"Để trống nghĩa là tất cả vai trò được xem."}</small>
              </div>
            </div>
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
            <select data-testid={"workflow-step-approval-mode-" + index} value={step.approvalMode} onChange={(event) => updateStep(step.id, { approvalMode: event.target.value })}>
              <option value="SEQUENTIAL">{"Tuần tự"}</option>
              <option value="PARALLEL">{"Đồng thời"}</option>
            </select>
            <select data-testid={"workflow-step-completion-rule-" + index} value={step.completionRule} onChange={(event) => updateStep(step.id, { completionRule: event.target.value })}>
              <option value="ALL">{"Tất cả"}</option>
              <option value="ANY">{"Một người"}</option>
              <option value="MIN_COUNT">{"Tối thiểu số lượng"}</option>
              <option value="MIN_PERCENT">{"Tối thiểu tỷ lệ"}</option>
            </select>
            {step.completionRule === "MIN_COUNT" && (
              <input
                data-testid={"workflow-step-min-count-" + index}
                type="number"
                min={1}
                value={step.minCount}
                onChange={(event) => updateStep(step.id, { minCount: Number(event.target.value) })}
              />
            )}
            {step.completionRule === "MIN_PERCENT" && (
              <input
                data-testid={"workflow-step-min-percent-" + index}
                type="number"
                min={1}
                max={100}
                value={step.minPercent}
                onChange={(event) => updateStep(step.id, { minPercent: Number(event.target.value) })}
              />
            )}
            <input
              data-testid={"workflow-step-deadline-amount-" + index}
              type="number"
              min={0}
              value={step.deadlineAmount}
              onChange={(event) => updateStep(step.id, { deadlineAmount: Number(event.target.value) })}
            />
            <select
              data-testid={"workflow-step-deadline-unit-" + index}
              value={step.deadlineUnit}
              onChange={(event) => updateStep(step.id, { deadlineUnit: event.target.value })}
            >
              <option value="HOUR">{"Giờ"}</option>
              <option value="DAY">{"Ngày"}</option>
            </select>
            <button className="icon-button" type="button" title="Xóa bước" disabled={approvalSteps.length <= 1} onClick={() => removeApprovalStep(step.id)}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {approvalSteps.length > 1 && (
          <div className="condition-list">
            {approvalSteps.slice(0, -1).map((step, index) => (
              <div className="condition-row" key={"condition-" + step.id}>
                <label className="toggle-line compact-toggle">
                  <input
                    data-testid={"workflow-condition-toggle-" + index}
                    type="checkbox"
                    checked={step.conditionalNext}
                    onChange={(event) => updateStep(step.id, { conditionalNext: event.target.checked })}
                  />
                  {"Chỉ chuyển sang bước kế tiếp khi"}
                </label>
                <select data-testid={"workflow-condition-field-" + index} value={step.conditionFieldCode} onChange={(event) => updateStep(step.id, { conditionFieldCode: event.target.value })} disabled={!step.conditionalNext}>
                  {fields.map((field) => (
                    <option key={field.id} value={normalizeWorkflowCode(field.code)}>
                      {field.name}
                    </option>
                  ))}
                </select>
                <select data-testid={"workflow-condition-operator-" + index} value={step.conditionOperator} onChange={(event) => updateStep(step.id, { conditionOperator: event.target.value })} disabled={!step.conditionalNext}>
                  {conditionOperatorOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  data-testid={"workflow-condition-value-" + index}
                  placeholder="Giá trị so sánh"
                  value={step.conditionValue}
                  onChange={(event) => updateStep(step.id, { conditionValue: event.target.value })}
                  disabled={!step.conditionalNext || step.conditionOperator === "exists"}
                />
              </div>
            ))}
          </div>
        )}
        <button
          className="ghost-button compact"
          data-testid="workflow-step-add"
          type="button"
          onClick={() => appendApprovalStep()}
        >
          <Plus size={16} />
          {"Thêm bước"}
        </button>
      </fieldset>
      <fieldset className={`workflow-builder-preview full ${previewDevice}`} data-testid="workflow-builder-preview">
        <legend>Preview quy trình</legend>
        <div className="builder-preview-head">
          <div>
            <strong>{form.name.trim() || "Mẫu quy trình mới"}</strong>
            <span>{form.code.trim() || "WORKFLOW_CODE"}</span>
            <small>Quản lý: {managerName}</small>
            <small>Khởi tạo: {starterRoleLabel}</small>
          </div>
          <div className="builder-preview-tools">
            <span className="status-chip">
              {previewFields.length} trường · {previewSteps.length} bước
            </span>
            <div className="segmented-control" data-testid="workflow-preview-device">
              <button
                className={previewDevice === "desktop" ? "active" : ""}
                data-testid="workflow-preview-desktop"
                type="button"
                title="Preview PC"
                aria-pressed={previewDevice === "desktop"}
                onClick={() => setPreviewDevice("desktop")}
              >
                <Monitor size={15} />
                PC
              </button>
              <button
                className={previewDevice === "mobile" ? "active" : ""}
                data-testid="workflow-preview-mobile"
                type="button"
                title="Preview mobile"
                aria-pressed={previewDevice === "mobile"}
                onClick={() => setPreviewDevice("mobile")}
              >
                <Smartphone size={15} />
                Mobile
              </button>
            </div>
          </div>
        </div>
        <div className="builder-preview-grid">
          <section className="preview-card" data-testid="workflow-preview-form">
            <h3>Biểu mẫu nhập liệu</h3>
            <div className="preview-list">
              {previewFields.map((field) => (
                <article key={field.id} data-testid={`workflow-preview-field-${field.order}`}>
                  <div className="preview-item-title">
                    <strong>
                      {field.order}. {field.name}
                    </strong>
                    <span>{field.typeLabel}</span>
                  </div>
                  <p>
                    {field.code} · {field.requiredLabel}
                  </p>
                  {field.placeholder && <small>Gợi ý: {field.placeholder}</small>}
                  {field.defaultLabel && <small>Mặc định: {field.defaultLabel}</small>}
                  <small>{field.validationLabel}</small>
                  <small>Buoc duoc sua: {field.editableLabel}</small>
                  <small>Vai trò xem: {field.roleLabel}</small>
                </article>
              ))}
            </div>
          </section>
          <section className="preview-card" data-testid="workflow-preview-steps">
            <h3>Luồng xử lý</h3>
            <div className="step-preview">
              {previewSteps.map((step) => (
                <article key={step.id} data-testid={`workflow-preview-step-${step.order}`}>
                  <div className="preview-item-title">
                    <strong>
                      {step.order}. {step.name}
                    </strong>
                    <span>{step.deadlineLabel}</span>
                  </div>
                  <p>
                    {step.code} · {step.resolverLabel}
                  </p>
                  <small>{step.completionLabel}</small>
                  <small>{step.reminderLabel}</small>
                  <small>{step.conditionLabel}</small>
                </article>
              ))}
              <article className="preview-end-node" data-testid="workflow-preview-end">
                <CheckCircle2 size={16} />
                <span>Kết thúc quy trình</span>
              </article>
            </div>
          </section>
        </div>
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
        <button className="primary-button compact" data-testid="workflow-instance-create" type="button" onClick={() => setPage("newInstance")}>
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

function WorkflowDynamicField({
  field,
  value,
  error,
  catalogOptions,
  readOnly,
  onChange
}: {
  field: WorkflowFormField;
  value: unknown;
  error?: string;
  catalogOptions?: Array<{ value: string; label: string }>;
  readOnly?: boolean;
  onChange: (value: unknown) => void;
}) {
  const testId = "workflow-instance-field-" + field.code;
  const layout = workflowFieldLayout(field);
  const columnSpan = layout.columnSpan === 2 ? "span-2" : "span-1";
  if (field.type === "HEADING") {
    return (
      <div className="workflow-field-heading">
        <h3>{field.name}</h3>
        {field.placeholder && <p>{field.placeholder}</p>}
      </div>
    );
  }

  const commonProps = {
    "data-testid": testId,
    disabled: readOnly,
    required: field.isRequired,
    placeholder: field.placeholder ?? undefined
  };
  const choiceOptions = catalogOptions?.length
    ? catalogOptions
    : workflowFieldOptions(field).map((option) => ({ value: option, label: option }));

  return (
    <label className={`workflow-dynamic-field ${columnSpan} ${readOnly ? "readonly" : ""}`}>
      {field.name}
      {field.isRequired && <span className="required-mark"> *</span>}
      {field.type === "LONG_TEXT" || field.type === "TABLE" ? (
        <textarea {...commonProps} value={String(value ?? "")} rows={field.type === "TABLE" ? 5 : 3} onChange={(event) => onChange(event.target.value)} />
      ) : field.type === "CHECKBOX" ? (
        <span className="toggle-line dynamic-checkbox">
          <input data-testid={testId} type="checkbox" checked={Boolean(value)} disabled={readOnly} onChange={(event) => onChange(event.target.checked)} />
          <span>Đã chọn</span>
        </span>
      ) : field.type === "SELECT" && choiceOptions.length > 0 ? (
        <select {...commonProps} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
          <option value="">{"Chọn giá trị"}</option>
          {choiceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : field.type === "RADIO" && choiceOptions.length > 0 ? (
        <div className="workflow-radio-options" data-testid={testId}>
          {choiceOptions.map((option) => (
            <label className="toggle-line compact-toggle" key={option.value}>
              <input name={field.code} type="radio" checked={String(value ?? "") === option.value} disabled={readOnly} value={option.value} onChange={(event) => onChange(event.target.value)} />
              {option.label}
            </label>
          ))}
        </div>
      ) : (
        <input
          {...commonProps}
          type={field.type === "NUMBER" || field.type === "CURRENCY" ? "number" : field.type === "DATE" ? "date" : field.type === "DATETIME" ? "datetime-local" : "text"}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {(field.type === "ATTACHMENT" ||
        field.type === "USER_SELECT" ||
        field.type === "DEPARTMENT_SELECT" ||
        ((field.type === "SELECT" || field.type === "RADIO") && choiceOptions.length === 0)) && (
        <small className="field-hint">Phiên bản này lưu giá trị nhập; danh sách lựa chọn và upload chuyên dụng sẽ được nối ở bước tiếp theo.</small>
      )}
      {readOnly && <small className="field-hint">Truong nay duoc he thong tu tinh tu cac truong nguon.</small>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function NewWorkflowInstance({ setPage, setInstanceId }: WorkflowPageProps) {
  const templates = useAsyncData(() => api.workflowTemplates(), []);
  const me = useAsyncData(() => api.me(), []);
  const [templateId, setTemplateId] = useState("");
  const templateDetail = useAsyncData<WorkflowTemplateDetail | null>(
    () => (templateId ? (api.workflowTemplate(templateId) as Promise<WorkflowTemplateDetail>) : Promise.resolve(null)),
    [templateId]
  );
  const selectedVersion = activeWorkflowVersion(templateDetail.data);
  const fields = selectedVersion?.fields ?? emptyWorkflowFields;
  const currentRoles = me.data?.roles ?? emptyWorkflowRoles;
  const roleVisibleFields = useMemo(() => filterWorkflowFieldsByRoles(fields, currentRoles), [fields, currentRoles]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [catalogOptionsByCode, setCatalogOptionsByCode] = useState<Record<string, Array<{ value: string; label: string }>>>({});
  const visibleFields = useMemo(() => roleVisibleFields.filter((field) => workflowFieldVisibleByValues(field, values)), [roleVisibleFields, values]);
  const groupedVisibleFields = useMemo(() => groupWorkflowFieldsByLayout(visibleFields), [visibleFields]);
  const catalogSourceCodes = useMemo(
    () =>
      Array.from(
        new Set(
          roleVisibleFields
            .map((field) => workflowCatalogSource(field)?.catalogCode)
            .filter((code): code is string => Boolean(code))
        )
      ),
    [roleVisibleFields]
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setValues(roleVisibleFields.length > 0 ? applyWorkflowCalculations(roleVisibleFields, buildInitialWorkflowValues(roleVisibleFields)) : {});
    setFieldErrors({});
  }, [selectedVersion?.id, roleVisibleFields]);

  useEffect(() => {
    let cancelled = false;
    if (catalogSourceCodes.length === 0) {
      setCatalogOptionsByCode({});
      return () => {
        cancelled = true;
      };
    }
    void Promise.all(
      catalogSourceCodes.map(async (code) => {
        const options = await api.sharedCatalogOptions(code).catch(() => []);
        return [
          code,
          options.map((option) => ({
            value: String(option.value ?? option.code ?? ""),
            label: String(option.label ?? option.name ?? option.value ?? option.code ?? "")
          })).filter((option) => option.value && option.label)
        ] as const;
      })
    ).then((entries) => {
      if (!cancelled) {
        setCatalogOptionsByCode(Object.fromEntries(entries));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [catalogSourceCodes]);

  function updateValue(code: string, value: unknown) {
    setValues((current) => {
      const next = applyWorkflowCalculations(roleVisibleFields, { ...current, [code]: value });
      return shallowWorkflowValuesEqual(current, next) ? current : next;
    });
    setFieldErrors((current) => {
      if (!current[code]) return current;
      const next = { ...current };
      delete next[code];
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!templateId || !selectedVersion) {
      setError("Vui lòng chọn mẫu quy trình.");
      return;
    }
    const nextValues = applyWorkflowCalculations(roleVisibleFields, values);
    const runtimeVisibleFields = roleVisibleFields.filter((field) => workflowFieldVisibleByValues(field, nextValues));
    if (!shallowWorkflowValuesEqual(values, nextValues)) {
      setValues(nextValues);
    }
    const nextFieldErrors = validateWorkflowValues(runtimeVisibleFields, nextValues);
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      setError("Vui lòng kiểm tra lại các trường bắt buộc hoặc sai định dạng.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const instance = await api.submitWorkflowInstance({
        templateId,
        formData: serializeWorkflowValues(runtimeVisibleFields, nextValues),
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
        <select data-testid="workflow-instance-template" value={templateId} onChange={(event) => setTemplateId(event.target.value)} required>
          <option value="">Chọn mẫu</option>
          {(templates.data ?? []).map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>
      {templateId && templateDetail.loading && <LoadingBlock />}
      {templateDetail.error && <p className="form-error">{templateDetail.error}</p>}
      {selectedVersion && (
        <fieldset className="dynamic-form-fields dynamic-form-layout">
          <legend>
            Biểu mẫu phiên bản {selectedVersion.versionNo}
          </legend>
          {groupedVisibleFields.map((group) => (
            <section className="dynamic-layout-tab" key={group.tab}>
              <h3>{group.tab}</h3>
              {group.sections.map((section) => (
                <div className="dynamic-layout-section" key={section.section}>
                  <h4>{section.section}</h4>
                  <div className="dynamic-layout-grid">
                    {section.fields.map((field) => (
                      <WorkflowDynamicField
                        key={field.id ?? field.code}
                        field={field}
                        value={values[field.code]}
                        error={fieldErrors[field.code]}
                        catalogOptions={workflowCatalogSource(field) ? catalogOptionsByCode[workflowCatalogSource(field)!.catalogCode] : undefined}
                        readOnly={Boolean(workflowFieldCalculation(field))}
                        onChange={(value) => updateValue(field.code, value)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </fieldset>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button className="ghost-button" type="button" onClick={() => setPage("workflowInstances")}>
          Hủy
        </button>
        <button className="primary-button" data-testid="workflow-instance-submit" type="submit" disabled={loading || templateDetail.loading || !selectedVersion}>
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
  const users = useAsyncData(() => api.users(), []);
  const me = useAsyncData(() => api.me(), []);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<WorkflowActionType | null>(null);
  const [actionComment, setActionComment] = useState("");
  const [actionFiles, setActionFiles] = useState<File[]>([]);
  const [transferToUserId, setTransferToUserId] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);
  const [supplementValues, setSupplementValues] = useState<Record<string, unknown>>({});
  const [supplementFieldErrors, setSupplementFieldErrors] = useState<Record<string, string>>({});
  const [supplementError, setSupplementError] = useState("");
  const [supplementMessage, setSupplementMessage] = useState("");
  const [supplementLoading, setSupplementLoading] = useState(false);
  const detailFields = useMemo(
    () =>
      filterWorkflowFieldsByRoles(
        (data?.workflowVersion?.fields ?? emptyWorkflowFields) as WorkflowFormField[],
        me.data?.roles ?? emptyWorkflowRoles
      ).filter((field) => field.type !== "HEADING"),
    [data?.workflowVersion?.fields, me.data?.roles]
  );
  const currentStepCode = (data?.currentStep?.code ?? null) as string | null;
  const formData = useMemo(() => (data?.formData ?? {}) as Record<string, unknown>, [data?.formData]);
  const supplementFields = useMemo(
    () => detailFields.filter((field) => workflowFieldEditableForStep(field, currentStepCode)),
    [currentStepCode, detailFields]
  );
  const canSupplement = Boolean(
    data && me.data && data.status === "NEEDS_INFO" && data.requesterId === me.data.id && supplementFields.length > 0
  );

  useEffect(() => {
    if (!data || data.status !== "NEEDS_INFO") {
      setSupplementValues({});
      setSupplementFieldErrors({});
      setSupplementError("");
      return;
    }
    setSupplementValues(buildWorkflowValuesFromData(supplementFields, formData));
    setSupplementFieldErrors({});
    setSupplementError("");
  }, [currentStepCode, data, formData, supplementFields]);

  function openAction(action: WorkflowActionType) {
    setPendingAction(action);
    setActionComment("");
    setActionFiles([]);
    setTransferToUserId("");
    setActionError("");
    setActionMessage("");
  }

  function addActionFiles(files: FileList | null) {
    const result = collectAllowedWorkflowAttachmentFiles(files);
    setActionError(result.error);
    setActionFiles((current) => [...current, ...result.accepted]);
  }

  async function downloadWorkflowAttachment(attachment: Record<string, any>) {
    setDownloadingAttachmentId(attachment.id);
    setActionError("");
    try {
      const { blob, filename } = await api.downloadWorkflowAttachment(attachment.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || attachment.originalName || "download";
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Không tải được tệp.");
    } finally {
      setDownloadingAttachmentId(null);
    }
  }

  async function confirmAction(event: FormEvent) {
    event.preventDefault();
    if (!instanceId || !pendingAction) return;
    if (pendingAction !== "APPROVE" && !actionComment.trim()) {
      setActionError("Vui lòng nhập ý kiến xử lý.");
      return;
    }
    if (pendingAction === "TRANSFER" && !transferToUserId) {
      setActionError("Vui lòng chọn người nhận chuyển xử lý.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      const uploaded: Record<string, any>[] = [];
      for (const file of actionFiles) {
        uploaded.push(await api.uploadWorkflowAttachment(instanceId, file));
      }
      await api.actWorkflow(instanceId, {
        action: pendingAction,
        comment: actionComment.trim(),
        transferToUserId: pendingAction === "TRANSFER" ? transferToUserId : undefined,
        attachmentIds: uploaded.map((attachment) => attachment.id),
        idempotencyKey: crypto.randomUUID()
      });
      setActionMessage("Đã xử lý hồ sơ thành công.");
      setPendingAction(null);
      setActionComment("");
      setActionFiles([]);
      setTransferToUserId("");
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Không xử lý được hồ sơ.");
    } finally {
      setBusy(false);
    }
  }

  function updateSupplementValue(code: string, value: unknown) {
    setSupplementValues((current) => ({ ...current, [code]: value }));
    setSupplementFieldErrors((current) => {
      if (!current[code]) return current;
      const next = { ...current };
      delete next[code];
      return next;
    });
    setSupplementError("");
    setSupplementMessage("");
  }

  async function submitSupplement(event: FormEvent) {
    event.preventDefault();
    if (!instanceId || !data) return;
    const nextFieldErrors = validateWorkflowValues(supplementFields, supplementValues);
    setSupplementFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      setSupplementError("Vui long kiem tra lai du lieu bo sung.");
      return;
    }
    setSupplementLoading(true);
    setSupplementError("");
    try {
      await api.supplementWorkflowInstance(instanceId, {
        formData: serializeWorkflowValues(supplementFields, supplementValues),
        idempotencyKey: crypto.randomUUID()
      });
      setSupplementMessage("Da gui bo sung va mo lai buoc xu ly.");
      await reload();
    } catch (err) {
      setSupplementError(err instanceof Error ? err.message : "Khong gui duoc du lieu bo sung.");
    } finally {
      setSupplementLoading(false);
    }
  }

  if (!instanceId) return <ErrorBlock message="Chưa chọn hồ sơ." />;
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  if (!data) return <ErrorBlock message="Không tìm thấy hồ sơ." />;

  const workflowTracker = buildWorkflowTracker(data);
  const completedTrackerSteps = workflowTracker.filter((node) => node.state === "done").length;
  const currentTrackerApprovers = uniqueWorkflowNames(workflowTracker.flatMap((node) => node.pendingApprovers));

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
        {detailFields.length > 0 ? (
          <div className="workflow-value-grid" data-testid="workflow-instance-values">
            {detailFields.map((field) => (
              <div key={field.id ?? field.code}>
                <span>{field.name}</span>
                <strong>{displayWorkflowValue(field, formData[field.code]) || "Chưa nhập"}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="json-view">{JSON.stringify(data.formData ?? {}, null, 2)}</div>
        )}
        {canSupplement && (
          <form className="approval-confirm-panel workflow-supplement-panel" data-testid="workflow-supplement-panel" onSubmit={submitSupplement}>
            <div>
              <h3>{"Bo sung ho so"}</h3>
              <p>{"Cap nhat cac truong duoc phep sua tai buoc hien tai roi gui lai cho nguoi xu ly."}</p>
            </div>
            <fieldset className="dynamic-form-fields">
              <legend>{"Du lieu bo sung"}</legend>
              {supplementFields.map((field) => (
                <WorkflowDynamicField
                  key={field.id ?? field.code}
                  field={field}
                  value={supplementValues[field.code]}
                  error={supplementFieldErrors[field.code]}
                  onChange={(value) => updateSupplementValue(field.code, value)}
                />
              ))}
            </fieldset>
            {supplementError && <p className="form-error">{supplementError}</p>}
            <div className="form-actions">
              <button className="primary-button" data-testid="workflow-supplement-submit" type="submit" disabled={supplementLoading}>
                {supplementLoading && <Loader2 className="spin" size={16} />}
                {"Gui bo sung"}
              </button>
            </div>
          </form>
        )}
        {supplementMessage && <p className="success-text" data-testid="workflow-supplement-message">{supplementMessage}</p>}
        <section className="workflow-tracker-panel" data-testid="workflow-progress-map">
          <div className="panel-head wrap">
            <div>
              <h2>Sơ đồ theo dõi quy trình</h2>
              <p data-testid="workflow-progress-summary">
                Đã hoàn tất {completedTrackerSteps}/{workflowTracker.length} bước
                {data.currentStep?.name ? ` · Bước hiện tại: ${data.currentStep.name}` : ""}
              </p>
            </div>
            <span className="status-chip" data-testid="workflow-progress-current-users">
              {currentTrackerApprovers.length > 0 ? currentTrackerApprovers.join(", ") : "Không có người đang chờ"}
            </span>
          </div>
          <ol className="workflow-tracker">
            {workflowTracker.map((node, index) => (
              <li
                key={node.step.id}
                className={`workflow-tracker-step ${node.state}`}
                data-testid={`workflow-progress-step-${node.step.code}`}
              >
                <div className="workflow-step-marker" aria-hidden="true">
                  <WorkflowTrackerIcon state={node.state} />
                </div>
                <div className="workflow-step-card">
                  <div className="workflow-step-title">
                    <strong>
                      {index + 1}. {node.step.name}
                    </strong>
                    <span>{workflowStepStateLabels[node.state]}</span>
                  </div>
                  <div className="workflow-step-meta">
                    <span>{workflowStepModeLabel(node.step)}</span>
                    <span>{workflowDeadlineLabel(node.step, node.runtimeSteps)}</span>
                  </div>
                  <div className="workflow-step-people">
                    {node.pendingApprovers.length > 0 && <span>Đang chờ: {node.pendingApprovers.join(", ")}</span>}
                    {node.completedApprovers.length > 0 && <span>Đã xử lý: {node.completedApprovers.join(", ")}</span>}
                    {node.pendingApprovers.length === 0 && node.completedApprovers.length === 0 && <span>Chưa phát sinh người xử lý.</span>}
                  </div>
                  {node.transitionLabel && (
                    <small className="workflow-step-transition">
                      <GitBranch size={14} />
                      {node.transitionLabel}
                    </small>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
        <div className="approval-actions">
          <button
            className="primary-button"
            data-testid="workflow-action-approve"
            type="button"
            disabled={busy}
            onClick={() => openAction("APPROVE")}
          >
            Duyệt
          </button>
          <button
            className="danger-button"
            data-testid="workflow-action-reject"
            type="button"
            disabled={busy}
            onClick={() => openAction("REJECT")}
          >
            Từ chối
          </button>
          <button
            className="ghost-button"
            data-testid="workflow-action-request-info"
            type="button"
            disabled={busy}
            onClick={() => openAction("REQUEST_INFO")}
          >
            Yêu cầu bổ sung
          </button>
          <button
            className="ghost-button"
            data-testid="workflow-action-return"
            type="button"
            disabled={busy}
            onClick={() => openAction("RETURN")}
          >
            Trả bước
          </button>
          <button
            className="ghost-button"
            data-testid="workflow-action-transfer"
            type="button"
            disabled={busy}
            onClick={() => openAction("TRANSFER")}
          >
            Chuyển xử lý
          </button>
        </div>
        {pendingAction && (
          <form className="approval-confirm-panel" data-testid="workflow-action-panel" onSubmit={confirmAction}>
            <div>
              <h3>{workflowActionLabels[pendingAction]}</h3>
              <p>Kiểm tra nội dung trước khi xác nhận thao tác.</p>
            </div>
            {pendingAction === "TRANSFER" && (
              <label>
                Người nhận xử lý
                <select
                  data-testid="workflow-action-transfer-user"
                  value={transferToUserId}
                  onChange={(event) => {
                    setTransferToUserId(event.target.value);
                    setActionError("");
                  }}
                >
                  <option value="">Chọn người nhận</option>
                  {(users.data?.data ?? []).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Ý kiến xử lý
              <textarea
                data-testid="workflow-action-comment"
                value={actionComment}
                rows={3}
                placeholder={pendingAction === "APPROVE" ? "Có thể để trống khi duyệt" : "Nhập lý do hoặc yêu cầu cụ thể"}
                onChange={(event) => {
                  setActionComment(event.target.value);
                  setActionError("");
                }}
              />
            </label>
            <fieldset>
              <legend>Tệp đính kèm xử lý</legend>
              <label>
                <span className="inline-label">
                  <Upload size={16} />
                  Chọn tệp
                </span>
                <input
                  data-testid="workflow-action-attachment-input"
                  type="file"
                  multiple
                  accept={workflowAttachmentAccept}
                  onChange={(event) => {
                    addActionFiles(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <div className="selected-files" data-testid="workflow-action-attachment-list">
                {actionFiles.length === 0 ? (
                  <span>Chưa chọn tệp.</span>
                ) : (
                  actionFiles.map((file, index) => (
                    <button
                      key={`${file.name}-${file.lastModified}-${index}`}
                      className="file-chip"
                      type="button"
                      disabled={busy}
                      onClick={() => setActionFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                    >
                      <span>{file.name}</span>
                      <small>{formatWorkflowFileSize(file.size)}</small>
                    </button>
                  ))
                )}
              </div>
            </fieldset>
            {actionError && <p className="form-error">{actionError}</p>}
            <div className="form-actions">
              <button className="ghost-button" data-testid="workflow-action-cancel" type="button" disabled={busy} onClick={() => setPendingAction(null)}>
                Hủy
              </button>
              <button className={pendingAction === "REJECT" ? "danger-button" : "primary-button"} data-testid="workflow-action-confirm" type="submit" disabled={busy}>
                {busy && <Loader2 className="spin" size={16} />}
                Xác nhận
              </button>
            </div>
          </form>
        )}
        {actionMessage && <p className="success-text" data-testid="workflow-action-message">{actionMessage}</p>}
      </article>
      <section className="panel">
        <div className="panel-head">
          <h2>Lịch sử xử lý</h2>
          <button className="ghost-button compact" type="button" onClick={() => setPage("workflowInstances")}>
            Quay lại
          </button>
        </div>
        <div className="timeline" data-testid="workflow-approval-history">
          {(data.approvals ?? []).map((approval: Record<string, any>) => (
            <div key={approval.id}>
              <strong>{approval.approver?.fullName}</strong>
              <span>{approval.step?.name}</span>
              <small>{approval.action ?? approval.status}</small>
              {approval.comment && <p>{approval.comment}</p>}
              {approval.attachments?.length > 0 && (
                <div className="attachment-list" data-testid={`workflow-approval-attachments-${approval.id}`}>
                  {approval.attachments.map((attachment: Record<string, any>) => (
                    <button key={attachment.id} className="attachment-pill" type="button" disabled={downloadingAttachmentId === attachment.id} onClick={() => downloadWorkflowAttachment(attachment)}>
                      <Download size={14} />
                      <span>{attachment.originalName}</span>
                      <small>{formatWorkflowFileSize(attachment.sizeBytes)}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
