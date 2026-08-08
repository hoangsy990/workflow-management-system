import { Download, Edit3, Loader2, Plus, Save, Trash2, Upload, XCircle } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { DataTable, ErrorBlock, LoadingBlock, MultiCheck } from "../components/common";
import { useAsyncData } from "../hooks/useAsyncData";
import { cls, formatDate, statusLabels } from "../lib/format";

const permissionGroupLabels: Record<string, string> = {
  user: "Người dùng",
  department: "Phòng ban",
  role: "Vai trò và quyền",
  task: "Công việc",
  workflow: "Quy trình",
  notification: "Thông báo",
  audit: "Nhật ký",
  setting: "Cấu hình"
};

const permissionActionLabels: Record<string, string> = {
  read: "Xem",
  manage: "Quản lý",
  create: "Tạo mới",
  comment: "Bình luận",
  assign: "Giao việc",
  evaluate: "Đánh giá",
  approve: "Phê duyệt",
  read_all: "Xem toàn bộ",
  read_team: "Xem nhóm",
  update_any: "Sửa toàn bộ",
  "template.manage": "Quản lý mẫu",
  "instance.create": "Tạo hồ sơ",
  "instance.approve": "Xử lý hồ sơ",
  "instance.read_all": "Xem mọi hồ sơ"
};

function permissionGroupName(group?: string) {
  if (!group) return "Khác";
  return permissionGroupLabels[group] ?? group;
}

function permissionActionName(code: string) {
  const [, ...parts] = code.split(".");
  const action = parts.join(".");
  return permissionActionLabels[action] ?? action.replace(/_/g, " ");
}

function extractRolePermissionIds(role?: Record<string, any>) {
  return (role?.permissions ?? []).map((item: Record<string, any>) => item.permission.id);
}

function isSameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}

function resolvePermissionCodes(permissions: Record<string, any>[] | null | undefined, selectedIds: Set<string>) {
  return new Set((permissions ?? []).filter((permission) => selectedIds.has(permission.id)).map((permission) => permission.code));
}

function describePermissionScope(codes: Set<string>) {
  const taskScope = codes.has("task.read_all")
    ? "Toàn bộ công việc"
    : codes.has("task.read_team")
      ? "Công việc trong phạm vi quản lý"
      : codes.has("task.create") || codes.has("task.comment")
        ? "Công việc được giao/liên quan"
        : "Chưa có quyền xem công việc";
  const workflowScope = codes.has("workflow.instance.read_all")
    ? "Toàn bộ hồ sơ quy trình"
    : codes.has("workflow.instance.approve")
      ? "Hồ sơ đang chờ xử lý"
      : codes.has("workflow.instance.create")
        ? "Hồ sơ do người dùng tạo"
        : "Chưa có quyền hồ sơ";
  return [
    { label: "Phạm vi công việc", value: taskScope },
    { label: "Phạm vi quy trình", value: workflowScope },
    { label: "Quản trị hệ thống", value: codes.has("setting.manage") || codes.has("role.manage") ? "Có quyền cấu hình/quyền hạn" : "Không" },
    { label: "Thông báo và audit", value: [codes.has("notification.read") && "Thông báo", codes.has("audit.read") && "Nhật ký"].filter(Boolean).join(", ") || "Không" }
  ];
}

function buildPermissionWarnings(codes: Set<string>) {
  const warnings: string[] = [];
  const needsReadPairs = [
    ["user.manage", "user.read", "Quản lý người dùng nên đi kèm quyền xem người dùng."],
    ["department.manage", "department.read", "Quản lý phòng ban nên đi kèm quyền xem phòng ban."],
    ["role.manage", "role.read", "Quản lý vai trò nên đi kèm quyền xem vai trò."],
    ["task.update_any", "task.read_all", "Sửa toàn bộ công việc nên đi kèm quyền xem toàn bộ công việc."],
    ["workflow.template.manage", "workflow.instance.read_all", "Quản lý mẫu quy trình nên có quyền xem hồ sơ để kiểm tra tác động."]
  ] as const;
  for (const [manageCode, readCode, message] of needsReadPairs) {
    if (codes.has(manageCode) && !codes.has(readCode)) {
      warnings.push(message);
    }
  }
  if (codes.has("task.assign") && !codes.has("task.create") && !codes.has("task.update_any")) {
    warnings.push("Giao việc nên có quyền tạo hoặc sửa công việc tương ứng.");
  }
  if (codes.has("workflow.instance.approve") && !codes.has("workflow.instance.create") && !codes.has("workflow.instance.read_all")) {
    warnings.push("Người phê duyệt chỉ thấy hồ sơ đang chờ xử lý; đây là phạm vi hẹp có chủ đích.");
  }
  return warnings;
}

const emptyUserForm = {
  employeeCode: "",
  fullName: "",
  email: "",
  phone: "",
  password: "Demo@123456",
  title: "",
  departmentId: "",
  managerId: "",
  roleIds: [] as string[],
  teamIds: [] as string[]
};

function extractUserRoleIds(user?: Record<string, any>) {
  return (user?.roles ?? []).map((item: Record<string, any>) => item.role.id);
}

function extractUserTeamIds(user?: Record<string, any>) {
  return (user?.teams ?? []).map((item: Record<string, any>) => item.team.id);
}

function buildUserEditForm(user: Record<string, any>) {
  return {
    fullName: user.fullName ?? "",
    phone: user.phone ?? "",
    title: user.title ?? "",
    departmentId: user.department?.id ?? "",
    managerId: user.manager?.id ?? "",
    status: user.status ?? "ACTIVE",
    roleIds: extractUserRoleIds(user),
    teamIds: extractUserTeamIds(user)
  };
}

type UserImportPreview = {
  rows: Array<Record<string, any>>;
  summary: {
    total: number;
    valid: number;
    invalid: number;
  };
  canApply: boolean;
  applied?: number;
};

export function UsersPage() {
  const { data, loading, error, reload } = useAsyncData(() => api.users(), []);
  const departments = useAsyncData(() => api.departments(), []);
  const roles = useAsyncData(() => api.roles(), []);
  const teams = useAsyncData(() => api.teams(), []);
  const [form, setForm] = useState<Record<string, any>>({ ...emptyUserForm });
  const [selectedId, setSelectedId] = useState("");
  const [editForm, setEditForm] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [updateError, setUpdateError] = useState("");
  const [importCsv, setImportCsv] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importPreview, setImportPreview] = useState<UserImportPreview | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importApplying, setImportApplying] = useState(false);
  const [importError, setImportError] = useState("");

  const users = useMemo(() => data?.data ?? [], [data]);
  const selectedUser = useMemo(() => users.find((user) => user.id === selectedId), [users, selectedId]);

  useEffect(() => {
    const firstUser = users[0];
    if (!selectedId && firstUser) {
      setSelectedId(firstUser.id);
    }
  }, [selectedId, users]);

  useEffect(() => {
    if (selectedUser) {
      setEditForm(buildUserEditForm(selectedUser));
      setUpdateError("");
    }
  }, [selectedUser]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setCreateError("");
    try {
      const created = await api.createUser({
        ...form,
        phone: form.phone || undefined,
        title: form.title || undefined,
        departmentId: form.departmentId || undefined,
        managerId: form.managerId || undefined
      });
      setSelectedId(created.id);
      setForm({ ...emptyUserForm });
      await reload();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Không tạo được người dùng.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSelectedUser(event: FormEvent) {
    event.preventDefault();
    if (!selectedUser || !editForm || updating) return;
    if (!window.confirm("Xác nhận cập nhật tài khoản này?")) return;
    setUpdating(true);
    setUpdateError("");
    try {
      await api.updateUser(selectedUser.id, {
        fullName: editForm.fullName,
        phone: editForm.phone || null,
        title: editForm.title || null,
        departmentId: editForm.departmentId || null,
        managerId: editForm.managerId || null,
        status: editForm.status,
        roleIds: editForm.roleIds,
        teamIds: editForm.teamIds
      });
      await reload();
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Không cập nhật được người dùng.");
    } finally {
      setUpdating(false);
    }
  }

  async function loadImportFile(file?: File) {
    setImportError("");
    setImportPreview(null);
    if (!file) {
      setImportCsv("");
      setImportFileName("");
      return;
    }
    setImportFileName(file.name);
    const lowerName = file.name.toLowerCase();
    const isCsv = lowerName.endsWith(".csv") || file.type === "text/csv" || file.type.startsWith("text/");
    if (!isCsv) {
      setImportCsv("");
      setImportError("Phiên bản này hỗ trợ CSV; XLSX sẽ được nối ở giai đoạn sau.");
      return;
    }
    if (file.size > 1_000_000) {
      setImportCsv("");
      setImportError("File import tối đa 1MB.");
      return;
    }
    setImportCsv(await file.text());
  }

  async function previewImportUsers() {
    if (!importCsv.trim() || importLoading) return;
    setImportLoading(true);
    setImportError("");
    try {
      const preview = await api.importUsers({ csv: importCsv, apply: false });
      setImportPreview(preview as UserImportPreview);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Không đọc được file import.");
    } finally {
      setImportLoading(false);
    }
  }

  async function applyImportUsers() {
    if (!importCsv.trim() || !importPreview?.canApply || importApplying) return;
    if (!window.confirm("Xác nhận nhập các tài khoản hợp lệ từ file này?")) return;
    setImportApplying(true);
    setImportError("");
    try {
      const result = await api.importUsers({ csv: importCsv, apply: true });
      setImportPreview(result as UserImportPreview);
      await reload();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Không nhập được dữ liệu người dùng.");
    } finally {
      setImportApplying(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;

  return (
    <section className="page-grid">
      <form className="panel form-stack" onSubmit={submit}>
        <div className="panel-head">
          <h2>{"Tạo người dùng"}</h2>
        </div>
        <input placeholder="Mã nhân viên" value={form.employeeCode} onChange={(event) => setForm({ ...form, employeeCode: event.target.value })} required />
        <input placeholder="Họ tên" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
        <input placeholder="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        <input placeholder="Số điện thoại" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <input placeholder="Chức danh" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        <input placeholder="Mật khẩu" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
        <select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}>
          <option value="">{"Phòng ban"}</option>
          {(departments.data ?? []).map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <select value={form.managerId} onChange={(event) => setForm({ ...form, managerId: event.target.value })}>
          <option value="">{"Quản lý trực tiếp"}</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.fullName}
            </option>
          ))}
        </select>
        <MultiCheck
          label="Vai trò"
          items={roles.data ?? []}
          value={form.roleIds}
          onChange={(value) => setForm({ ...form, roleIds: value })}
        />
        <MultiCheck
          label="NhÃ³m lÃ m viá»‡c"
          items={teams.data ?? []}
          value={form.teamIds}
          onChange={(value) => setForm({ ...form, teamIds: value })}
        />
        {createError && <p className="form-error">{createError}</p>}
        <button className="primary-button" type="submit" disabled={saving}>
          {saving && <Loader2 className="spin" size={16} />}
          {"Lưu người dùng"}
        </button>
      </form>

      <section className="panel form-stack" data-testid="user-import-panel">
        <div className="panel-head wrap">
          <div>
            <h2>{"Nhập người dùng"}</h2>
            <p>{"CSV: employeeCode, fullName, email, phone, title, departmentCode, managerEmployeeCode, roleCodes, teamCodes, password"}</p>
          </div>
          <Upload size={18} />
        </div>
        <input
          data-testid="user-import-file"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => void loadImportFile(event.target.files?.[0])}
        />
        {importFileName && <span className="muted-text">{importFileName}</span>}
        <textarea
          data-testid="user-import-csv"
          placeholder="employeeCode,fullName,email,departmentCode,roleCodes"
          value={importCsv}
          onChange={(event) => {
            setImportCsv(event.target.value);
            setImportPreview(null);
          }}
        />
        {importError && <p className="form-error">{importError}</p>}
        {importPreview && (
          <div className="stack-list" data-testid="user-import-summary">
            <span>
              {"Tổng dòng "}
              <strong>{importPreview.summary.total}</strong>
            </span>
            <span>
              {"Hợp lệ "}
              <strong>{importPreview.summary.valid}</strong>
            </span>
            <span>
              {"Lỗi "}
              <strong>{importPreview.summary.invalid}</strong>
            </span>
            {typeof importPreview.applied === "number" && importPreview.applied > 0 && (
              <span>
                {"Đã nhập "}
                <strong>{importPreview.applied}</strong>
              </span>
            )}
          </div>
        )}
        {importPreview?.rows?.length ? (
          <DataTable
            columns={["Dòng", "Mã", "Họ tên", "Email", "Phòng ban", "Vai trò", "Trạng thái"]}
            rows={importPreview.rows.slice(0, 8).map((row) => ({
              key: String(row.rowNumber),
              testId: `user-import-row-${row.rowNumber}`,
              cells: [
                row.rowNumber,
                row.employeeCode,
                row.fullName,
                row.email,
                row.departmentCode ?? "",
                (row.roleCodes ?? []).join(", "),
                row.status === "VALID" ? "Hợp lệ" : (row.errors ?? []).join(" ")
              ]
            }))}
          />
        ) : null}
        <div className="form-actions">
          <button className="ghost-button" data-testid="user-import-preview" type="button" disabled={!importCsv.trim() || importLoading} onClick={previewImportUsers}>
            {importLoading && <Loader2 className="spin" size={16} />}
            {"Xem trước"}
          </button>
          <button
            className="primary-button"
            data-testid="user-import-apply"
            type="button"
            disabled={!importPreview?.canApply || importApplying}
            onClick={applyImportUsers}
          >
            {importApplying && <Loader2 className="spin" size={16} />}
            {"Nhập dữ liệu"}
          </button>
        </div>
      </section>

      <section className="panel wide">
        <div className="panel-head">
          <h2>{"Danh sách người dùng"}</h2>
        </div>
        <DataTable
          columns={["Mã", "Họ tên", "Email", "Phòng ban", "Quản lý", "Vai trò", "Nhóm", "Trạng thái"]}
          rows={users.map((user) => ({
            key: user.id,
            testId: `user-row-${user.id}`,
            onClick: () => setSelectedId(user.id),
            cells: [
              user.employeeCode,
              user.fullName,
              user.email,
              user.department?.name,
              user.manager?.fullName,
              user.roles?.map((item: Record<string, any>) => item.role.name).join(", "),
              user.teams?.map((item: Record<string, any>) => item.team.name).join(", "),
              statusLabels[user.status] ?? user.status
            ]
          }))}
        />
      </section>

      <form className="panel form-stack" onSubmit={saveSelectedUser}>
        <div className="panel-head wrap">
          <div>
            <h2>{"Chi tiết tài khoản"}</h2>
            {selectedUser && (
              <p>
                {selectedUser.employeeCode} - {selectedUser.email}
              </p>
            )}
          </div>
          {selectedUser && <span className="status-chip">{statusLabels[selectedUser.status] ?? selectedUser.status}</span>}
        </div>
        {!selectedUser || !editForm ? (
          <p className="empty-text">{"Chọn một người dùng trong danh sách để chỉnh sửa."}</p>
        ) : (
          <>
            <label>
              {"Họ tên"}
              <input
                data-testid="user-edit-full-name"
                value={editForm.fullName}
                onChange={(event) => setEditForm({ ...editForm, fullName: event.target.value })}
                required
              />
            </label>
            <label>
              {"Số điện thoại"}
              <input data-testid="user-edit-phone" value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} />
            </label>
            <label>
              {"Chức danh"}
              <input data-testid="user-edit-title" value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} />
            </label>
            <label>
              {"Phòng ban chính"}
              <select value={editForm.departmentId} onChange={(event) => setEditForm({ ...editForm, departmentId: event.target.value })}>
                <option value="">{"Chưa gán"}</option>
                {(departments.data ?? []).map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {"Quản lý trực tiếp"}
              <select value={editForm.managerId} onChange={(event) => setEditForm({ ...editForm, managerId: event.target.value })}>
                <option value="">{"Chưa gán"}</option>
                {users
                  .filter((user) => user.id !== selectedUser.id)
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              {"Trạng thái"}
              <select data-testid="user-edit-status" value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}>
                {["ACTIVE", "INACTIVE", "LOCKED"].map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status] ?? status}
                  </option>
                ))}
              </select>
            </label>
            <MultiCheck
              label="Vai trò"
              items={roles.data ?? []}
              value={editForm.roleIds}
              onChange={(value) => setEditForm({ ...editForm, roleIds: value })}
            />
            <MultiCheck
              label="Nhóm làm việc"
              items={teams.data ?? []}
              value={editForm.teamIds}
              onChange={(value) => setEditForm({ ...editForm, teamIds: value })}
            />
            <div className="stack-list">
              <span>
                {"Tạo ngày "}
                <strong>{formatDate(selectedUser.createdAt)}</strong>
              </span>
              <span>
                {"Đăng nhập gần nhất "}
                <strong>{formatDate(selectedUser.lastLoginAt) || "Chưa có"}</strong>
              </span>
            </div>
            {updateError && <p className="form-error">{updateError}</p>}
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => setEditForm(buildUserEditForm(selectedUser))}>
                {"Khôi phục"}
              </button>
              <button className="primary-button" data-testid="user-edit-save" type="submit" disabled={updating}>
                {updating && <Loader2 className="spin" size={16} />}
                {"Lưu thay đổi"}
              </button>
            </div>
          </>
        )}
      </form>
    </section>
  );
}

const emptyDepartmentForm = {
  code: "",
  name: "",
  description: "",
  parentId: "",
  managerId: ""
};

const emptyTeamForm = {
  code: "",
  name: "",
  departmentId: "",
  memberIds: [] as string[]
};

function buildDepartmentEditForm(department: Record<string, any>) {
  return {
    code: department.code ?? "",
    name: department.name ?? "",
    description: department.description ?? "",
    parentId: department.parent?.id ?? department.parentId ?? "",
    managerId: department.manager?.id ?? department.managerId ?? ""
  };
}

function buildTeamEditForm(team: Record<string, any>) {
  return {
    code: team.code ?? "",
    name: team.name ?? "",
    departmentId: team.department?.id ?? team.departmentId ?? "",
    memberIds: (team.members ?? []).map((member: Record<string, any>) => member.user.id)
  };
}

function flattenDepartments(departments: Record<string, any>[]) {
  const childrenByParent = new Map<string, Record<string, any>[]>();
  for (const department of departments) {
    const key = department.parent?.id ?? department.parentId ?? "root";
    childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), department]);
  }

  const rows: Array<{ department: Record<string, any>; depth: number }> = [];
  const seen = new Set<string>();
  const visit = (department: Record<string, any>, depth: number) => {
    if (seen.has(department.id)) return;
    seen.add(department.id);
    rows.push({ department, depth });
    for (const child of (childrenByParent.get(department.id) ?? []).sort((left, right) => left.name.localeCompare(right.name, "vi"))) {
      visit(child, depth + 1);
    }
  };

  for (const root of (childrenByParent.get("root") ?? []).sort((left, right) => left.name.localeCompare(right.name, "vi"))) {
    visit(root, 0);
  }
  for (const department of departments) {
    if (!seen.has(department.id)) {
      visit(department, 0);
    }
  }
  return rows;
}

function collectDepartmentDescendantIds(departments: Record<string, any>[], parentId: string) {
  const result = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const department of departments) {
      const currentParentId = department.parent?.id ?? department.parentId;
      if (currentParentId && (currentParentId === parentId || result.has(currentParentId)) && !result.has(department.id)) {
        result.add(department.id);
        changed = true;
      }
    }
  }
  return result;
}

function groupUsersByDepartment(users: Record<string, any>[]) {
  const map = new Map<string, Record<string, any>[]>();
  for (const user of users) {
    const departmentId = user.department?.id;
    if (!departmentId) continue;
    map.set(departmentId, [...(map.get(departmentId) ?? []), user]);
  }
  return map;
}

function groupTeamsByDepartment(teams: Record<string, any>[]) {
  const map = new Map<string, Record<string, any>[]>();
  for (const team of teams) {
    const departmentId = team.department?.id;
    if (!departmentId) continue;
    map.set(departmentId, [...(map.get(departmentId) ?? []), team]);
  }
  return map;
}

export function DepartmentsPage() {
  const { data, loading, error, reload } = useAsyncData(() => api.departments(), []);
  const users = useAsyncData(() => api.users(), []);
  const teamData = useAsyncData(() => api.teams(), []);
  const [form, setForm] = useState({ ...emptyDepartmentForm });
  const [teamForm, setTeamForm] = useState({ ...emptyTeamForm });
  const [selectedId, setSelectedId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [editForm, setEditForm] = useState<Record<string, any> | null>(null);
  const [teamEditForm, setTeamEditForm] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamUpdating, setTeamUpdating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [updateError, setUpdateError] = useState("");
  const [teamCreateError, setTeamCreateError] = useState("");
  const [teamUpdateError, setTeamUpdateError] = useState("");
  const [movingDepartmentId, setMovingDepartmentId] = useState("");
  const [moveError, setMoveError] = useState("");
  const [moveLoading, setMoveLoading] = useState(false);

  const departments = useMemo(() => data ?? [], [data]);
  const usersList = useMemo(() => users.data?.data ?? [], [users.data]);
  const teamsList = useMemo(() => teamData.data ?? [], [teamData.data]);
  const departmentRows = useMemo(() => flattenDepartments(departments), [departments]);
  const usersByDepartment = useMemo(() => groupUsersByDepartment(usersList), [usersList]);
  const teamsByDepartment = useMemo(() => groupTeamsByDepartment(teamsList), [teamsList]);
  const selectedDepartment = useMemo(() => departments.find((department) => department.id === selectedId), [departments, selectedId]);
  const selectedTeam = useMemo(() => teamsList.find((team) => team.id === selectedTeamId), [teamsList, selectedTeamId]);
  const descendantIds = useMemo(() => (selectedId ? collectDepartmentDescendantIds(departments, selectedId) : new Set<string>()), [departments, selectedId]);
  const parentOptions = useMemo(
    () => departments.filter((department) => department.id !== selectedId && !descendantIds.has(department.id)),
    [departments, descendantIds, selectedId]
  );

  useEffect(() => {
    const firstDepartment = departments[0];
    if (!selectedId && firstDepartment) {
      setSelectedId(firstDepartment.id);
    }
  }, [departments, selectedId]);

  useEffect(() => {
    if (selectedDepartment) {
      setEditForm(buildDepartmentEditForm(selectedDepartment));
      setUpdateError("");
    }
  }, [selectedDepartment]);

  useEffect(() => {
    const firstTeam = teamsList[0];
    if (!selectedTeamId && firstTeam) {
      setSelectedTeamId(firstTeam.id);
    }
  }, [selectedTeamId, teamsList]);

  useEffect(() => {
    if (selectedTeam) {
      setTeamEditForm(buildTeamEditForm(selectedTeam));
      setTeamUpdateError("");
    }
  }, [selectedTeam]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setCreateError("");
    try {
      const created = await api.saveDepartment({
        ...form,
        description: form.description || undefined,
        parentId: form.parentId || undefined,
        managerId: form.managerId || undefined
      });
      setSelectedId(created.id);
      setForm({ ...emptyDepartmentForm });
      await reload();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Không tạo được phòng ban.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSelectedDepartment(event: FormEvent) {
    event.preventDefault();
    if (!selectedDepartment || !editForm || updating) return;
    if (!window.confirm("Xác nhận cập nhật phòng ban này?")) return;
    setUpdating(true);
    setUpdateError("");
    try {
      await api.updateDepartment(selectedDepartment.id, {
        code: editForm.code,
        name: editForm.name,
        description: editForm.description || undefined,
        parentId: editForm.parentId || null,
        managerId: editForm.managerId || null
      });
      await reload();
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Không cập nhật được phòng ban.");
    } finally {
      setUpdating(false);
    }
  }

  async function moveDepartment(departmentId: string, parentId: string | null) {
    if (moveLoading || departmentId === parentId) return;
    const department = departments.find((item) => item.id === departmentId);
    if (!department) return;
    const descendantIds = collectDepartmentDescendantIds(departments, departmentId);
    if (parentId && descendantIds.has(parentId)) {
      setMoveError("Không thể chuyển phòng ban vào chính nhánh con của nó.");
      return;
    }
    setMoveLoading(true);
    setMoveError("");
    try {
      await api.updateDepartment(departmentId, { parentId });
      await reload();
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : "Không chuyển được phòng ban.");
    } finally {
      setMoveLoading(false);
      setMovingDepartmentId("");
    }
  }

  async function submitTeam(event: FormEvent) {
    event.preventDefault();
    setTeamSaving(true);
    setTeamCreateError("");
    try {
      const created = await api.saveTeam({
        ...teamForm,
        departmentId: teamForm.departmentId || undefined
      });
      setSelectedTeamId(created.id);
      setTeamForm({ ...emptyTeamForm });
      await teamData.reload();
      await reload();
    } catch (err) {
      setTeamCreateError(err instanceof Error ? err.message : "KhÃ´ng táº¡o Ä‘Æ°á»£c nhÃ³m lÃ m viá»‡c.");
    } finally {
      setTeamSaving(false);
    }
  }

  async function saveSelectedTeam(event: FormEvent) {
    event.preventDefault();
    if (!selectedTeam || !teamEditForm || teamUpdating) return;
    if (!window.confirm("XÃ¡c nháº­n cáº­p nháº­t nhÃ³m lÃ m viá»‡c nÃ y?")) return;
    setTeamUpdating(true);
    setTeamUpdateError("");
    try {
      await api.updateTeam(selectedTeam.id, {
        code: teamEditForm.code,
        name: teamEditForm.name,
        departmentId: teamEditForm.departmentId || null,
        memberIds: teamEditForm.memberIds
      });
      await teamData.reload();
    } catch (err) {
      setTeamUpdateError(err instanceof Error ? err.message : "KhÃ´ng cáº­p nháº­t Ä‘Æ°á»£c nhÃ³m lÃ m viá»‡c.");
    } finally {
      setTeamUpdating(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  return (
    <section className="page-grid">
      <form className="panel form-stack" onSubmit={submit}>
        <div className="panel-head">
          <h2>{"Tạo phòng ban"}</h2>
        </div>
        <input placeholder="Mã phòng ban" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required />
        <input placeholder="Tên phòng ban" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <textarea placeholder="Mô tả" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <select value={form.parentId} onChange={(event) => setForm({ ...form, parentId: event.target.value })}>
          <option value="">{"Không có phòng ban cha"}</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <select value={form.managerId} onChange={(event) => setForm({ ...form, managerId: event.target.value })}>
          <option value="">{"Quản lý"}</option>
          {usersList.map((user) => (
            <option key={user.id} value={user.id}>
              {user.fullName}
            </option>
          ))}
        </select>
        {createError && <p className="form-error">{createError}</p>}
        <button className="primary-button" type="submit" disabled={saving}>
          {saving && <Loader2 className="spin" size={16} />}
          {"Lưu phòng ban"}
        </button>
      </form>

      <section className="panel wide" data-testid="organization-chart">
        <div className="panel-head wrap">
          <div>
            <h2>Sơ đồ tổ chức</h2>
            <p>Hiển thị cây phòng ban, quản lý, nhân sự và nhóm làm việc từ dữ liệu thật.</p>
          </div>
          <span className="status-chip">{departmentRows.length} phòng ban</span>
        </div>
        {departmentRows.length === 0 ? (
          <p className="empty-text">Chưa có phòng ban.</p>
        ) : (
          <div className="org-chart">
            <div
              className={cls("org-drop-root", movingDepartmentId && "active")}
              data-testid="organization-root-drop"
              onDragOver={(event) => {
                if (movingDepartmentId) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                void moveDepartment(event.dataTransfer.getData("text/plain"), null);
              }}
            >
              {"Đưa về cấp gốc"}
            </div>
            {departmentRows.map(({ department, depth }) => {
              const departmentUsers = usersByDepartment.get(department.id) ?? [];
              const departmentTeams = teamsByDepartment.get(department.id) ?? [];
              return (
                <button
                  key={department.id}
                  type="button"
                  className={cls("org-node", selectedId === department.id && "active", movingDepartmentId === department.id && "moving")}
                  style={{ paddingLeft: `${14 + depth * 22}px` }}
                  data-testid={`organization-node-${department.id}`}
                  draggable
                  onClick={() => setSelectedId(department.id)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", department.id);
                    setMovingDepartmentId(department.id);
                  }}
                  onDragEnd={() => setMovingDepartmentId("")}
                  onDragOver={(event) => {
                    if (movingDepartmentId && movingDepartmentId !== department.id) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    void moveDepartment(event.dataTransfer.getData("text/plain"), department.id);
                  }}
                >
                  <span className="org-node-line" />
                  <span className="org-node-main">
                    <strong>{department.name}</strong>
                    <small>
                      {department.code}
                      {department.parent?.name ? ` · thuộc ${department.parent.name}` : " · cấp gốc"}
                    </small>
                  </span>
                  <span className="org-node-meta">
                    <span>QL: {department.manager?.fullName ?? "Chưa gán"}</span>
                    <span>{departmentUsers.length || department._count?.users || 0} nhân sự</span>
                    <span>{departmentTeams.length} nhóm</span>
                    <span>{department._count?.tasks ?? 0} công việc</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {moveError && <p className="form-error">{moveError}</p>}
        {moveLoading && <p className="muted-text">{"Đang chuyển phòng ban..."}</p>}
      </section>

      <section className="panel wide">
        <div className="panel-head wrap">
          <div>
            <h2>{"Cơ cấu tổ chức"}</h2>
            <p>{"Chọn một dòng để xem và cập nhật chi tiết."}</p>
          </div>
          <span className="status-chip">{departments.length} {"phòng ban"}</span>
        </div>
        <DataTable
          columns={["Mã", "Tên", "Phòng ban cha", "Quản lý", "Nhân sự", "Công việc"]}
          rows={departmentRows.map(({ department, depth }) => ({
            key: department.id,
            testId: "department-row-" + department.id,
            onClick: () => setSelectedId(department.id),
            cells: [
              department.code,
              "-- ".repeat(depth) + department.name,
              department.parent?.name ?? "",
              department.manager?.fullName,
              department._count?.users ?? 0,
              department._count?.tasks ?? 0
            ]
          }))}
        />
      </section>

      <form className="panel form-stack" onSubmit={saveSelectedDepartment}>
        <div className="panel-head wrap">
          <div>
            <h2>{"Chi tiết phòng ban"}</h2>
            {selectedDepartment && <p>{selectedDepartment.code}</p>}
          </div>
          {selectedDepartment && <span className="status-chip">{selectedDepartment._count?.users ?? 0} {"nhân sự"}</span>}
        </div>
        {!selectedDepartment || !editForm ? (
          <p className="empty-text">{"Chọn phòng ban trong danh sách để chỉnh sửa."}</p>
        ) : (
          <>
            <label>
              {"Mã phòng ban"}
              <input data-testid="department-edit-code" value={editForm.code} onChange={(event) => setEditForm({ ...editForm, code: event.target.value })} required />
            </label>
            <label>
              {"Tên phòng ban"}
              <input data-testid="department-edit-name" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} required />
            </label>
            <label>
              {"Mô tả"}
              <textarea data-testid="department-edit-description" value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} />
            </label>
            <label>
              {"Phòng ban cha"}
              <select data-testid="department-edit-parent" value={editForm.parentId} onChange={(event) => setEditForm({ ...editForm, parentId: event.target.value })}>
                <option value="">{"Không có"}</option>
                {parentOptions.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {"Quản lý phòng ban"}
              <select data-testid="department-edit-manager" value={editForm.managerId} onChange={(event) => setEditForm({ ...editForm, managerId: event.target.value })}>
                <option value="">{"Chưa gán"}</option>
                {usersList.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </select>
            </label>
            <div className="stack-list">
              <span>
                {"Phòng ban cha hiện tại "}
                <strong>{selectedDepartment.parent?.name ?? "Không có"}</strong>
              </span>
              <span>
                {"Số công việc "}
                <strong>{selectedDepartment._count?.tasks ?? 0}</strong>
              </span>
            </div>
            {updateError && <p className="form-error">{updateError}</p>}
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => setEditForm(buildDepartmentEditForm(selectedDepartment))}>
                {"Khôi phục"}
              </button>
              <button className="primary-button" data-testid="department-edit-save" type="submit" disabled={updating}>
                {updating && <Loader2 className="spin" size={16} />}
                {"Lưu thay đổi"}
              </button>
            </div>
          </>
        )}
      </form>

      <form className="panel form-stack" data-testid="team-create-form" onSubmit={submitTeam}>
        <div className="panel-head">
          <h2>{"Tạo nhóm làm việc"}</h2>
        </div>
        <input data-testid="team-create-code" placeholder="Mã nhóm" value={teamForm.code} onChange={(event) => setTeamForm({ ...teamForm, code: event.target.value })} required />
        <input data-testid="team-create-name" placeholder="Tên nhóm" value={teamForm.name} onChange={(event) => setTeamForm({ ...teamForm, name: event.target.value })} required />
        <select data-testid="team-create-department" value={teamForm.departmentId} onChange={(event) => setTeamForm({ ...teamForm, departmentId: event.target.value })}>
          <option value="">{"Không gắn phòng ban"}</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <div data-testid="team-create-members">
          <MultiCheck
            label="Thành viên"
            items={usersList}
            value={teamForm.memberIds}
            onChange={(value) => setTeamForm({ ...teamForm, memberIds: value })}
          />
        </div>
        {teamCreateError && <p className="form-error">{teamCreateError}</p>}
        <button className="primary-button" data-testid="team-create-save" type="submit" disabled={teamSaving}>
          {teamSaving && <Loader2 className="spin" size={16} />}
          {"Lưu nhóm"}
        </button>
      </form>

      <section className="panel wide">
        <div className="panel-head wrap">
          <div>
            <h2>{"Nhóm làm việc"}</h2>
            <p>{"Quản lý nhóm liên phòng ban và thành viên tham gia."}</p>
          </div>
          <span className="status-chip">{teamsList.length} {"nhóm"}</span>
        </div>
        {teamData.error && <p className="form-error">{teamData.error}</p>}
        <DataTable
          columns={["Mã", "Tên nhóm", "Phòng ban", "Thành viên"]}
          rows={teamsList.map((team) => ({
            key: team.id,
            testId: "team-row-" + team.id,
            onClick: () => setSelectedTeamId(team.id),
            cells: [
              team.code,
              team.name,
              team.department?.name ?? "",
              team.members?.map((member: Record<string, any>) => member.user.fullName).join(", ")
            ]
          }))}
        />
      </section>

      <form className="panel form-stack" data-testid="team-edit-form" onSubmit={saveSelectedTeam}>
        <div className="panel-head wrap">
          <div>
            <h2>{"Chi tiết nhóm"}</h2>
            {selectedTeam && <p>{selectedTeam.code}</p>}
          </div>
          {selectedTeam && <span className="status-chip">{selectedTeam._count?.members ?? 0} {"thành viên"}</span>}
        </div>
        {!selectedTeam || !teamEditForm ? (
          <p className="empty-text">{"Chọn nhóm trong danh sách để chỉnh sửa."}</p>
        ) : (
          <>
            <label>
              {"Mã nhóm"}
              <input data-testid="team-edit-code" value={teamEditForm.code} onChange={(event) => setTeamEditForm({ ...teamEditForm, code: event.target.value })} required />
            </label>
            <label>
              {"Tên nhóm"}
              <input data-testid="team-edit-name" value={teamEditForm.name} onChange={(event) => setTeamEditForm({ ...teamEditForm, name: event.target.value })} required />
            </label>
            <label>
              {"Phòng ban phụ trách"}
              <select data-testid="team-edit-department" value={teamEditForm.departmentId} onChange={(event) => setTeamEditForm({ ...teamEditForm, departmentId: event.target.value })}>
                <option value="">{"Không gắn phòng ban"}</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <div data-testid="team-edit-members">
              <MultiCheck
                label="Thành viên"
                items={usersList}
                value={teamEditForm.memberIds}
                onChange={(value) => setTeamEditForm({ ...teamEditForm, memberIds: value })}
              />
            </div>
            {teamUpdateError && <p className="form-error">{teamUpdateError}</p>}
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => setTeamEditForm(buildTeamEditForm(selectedTeam))}>
                {"Khôi phục"}
              </button>
              <button className="primary-button" data-testid="team-edit-save" type="submit" disabled={teamUpdating}>
                {teamUpdating && <Loader2 className="spin" size={16} />}
                {"Lưu thay đổi"}
              </button>
            </div>
          </>
        )}
      </form>
    </section>
  );
}

export function RolesPage() {
  const { data, loading, error, reload } = useAsyncData(() => api.roles(), []);
  const permissions = useAsyncData(() => api.permissions(), []);
  const [selected, setSelected] = useState("");
  const [permissionIds, setPermissionIds] = useState<string[]>([]);
  const [copySource, setCopySource] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const selectedRole = useMemo(() => (data ?? []).find((item) => item.id === selected), [data, selected]);
  const savedPermissionIds = useMemo(() => extractRolePermissionIds(selectedRole), [selectedRole]);
  const selectedPermissionSet = useMemo(() => new Set(permissionIds), [permissionIds]);
  const selectedPermissionCodes = useMemo(() => resolvePermissionCodes(permissions.data, selectedPermissionSet), [permissions.data, selectedPermissionSet]);
  const permissionScope = useMemo(() => describePermissionScope(selectedPermissionCodes), [selectedPermissionCodes]);
  const permissionWarnings = useMemo(() => buildPermissionWarnings(selectedPermissionCodes), [selectedPermissionCodes]);
  const hasChanges = !isSameStringSet(permissionIds, savedPermissionIds);
  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, Record<string, any>[]>();
    for (const permission of permissions.data ?? []) {
      const group = permission.group ?? "system";
      groups.set(group, [...(groups.get(group) ?? []), permission]);
    }
    return [...groups.entries()]
      .map(([group, items]) => ({
        group,
        label: permissionGroupName(group),
        items: items.sort((left, right) => left.code.localeCompare(right.code))
      }))
      .sort((left, right) => left.label.localeCompare(right.label, "vi"));
  }, [permissions.data]);

  useEffect(() => {
    const firstRole = data?.[0];
    if (!selected && firstRole) {
      setSelected(firstRole.id);
    }
  }, [data, selected]);

  useEffect(() => {
    if (selectedRole) {
      setPermissionIds(savedPermissionIds);
      setCopySource("");
      setSaveError("");
    }
  }, [selectedRole, savedPermissionIds]);

  async function save() {
    if (!selected || saving) return;
    if (!hasChanges) return;
    if (!window.confirm("Xác nhận lưu thay đổi quyền cho vai trò này?")) return;
    setSaving(true);
    setSaveError("");
    try {
      await api.updateRolePermissions(selected, permissionIds);
      await reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Không lưu được quyền hạn.");
    } finally {
      setSaving(false);
    }
  }

  function setPermission(permissionId: string, checked: boolean) {
    setPermissionIds((current) => {
      if (checked) return [...new Set([...current, permissionId])];
      return current.filter((item) => item !== permissionId);
    });
  }

  function setPermissionGroup(groupIds: string[], checked: boolean) {
    setPermissionIds((current) => {
      if (checked) return [...new Set([...current, ...groupIds])];
      const groupSet = new Set(groupIds);
      return current.filter((item) => !groupSet.has(item));
    });
  }

  function copyPermissionsFromRole() {
    const source = (data ?? []).find((role) => role.id === copySource);
    if (!source) return;
    setPermissionIds(extractRolePermissionIds(source));
    setSaveError("");
  }

  function resetPermissions() {
    setPermissionIds(savedPermissionIds);
    setSaveError("");
  }

  if (loading || permissions.loading) return <LoadingBlock />;
  if (error || permissions.error) return <ErrorBlock message={error || permissions.error} />;

  return (
    <section className="permission-layout">
      <section className="panel role-list-panel">
        <div className="panel-head">
          <div>
            <h2>Vai trò</h2>
            <p>Chọn vai trò để cấu hình quyền backend.</p>
          </div>
        </div>
        <div className="role-list">
          {(data ?? []).map((role) => (
            <button
              key={role.id}
              className={cls("role-card", selected === role.id && "active")}
              data-testid={`role-card-${role.code}`}
              type="button"
              aria-pressed={selected === role.id}
              onClick={() => setSelected(role.id)}
            >
              <span className="role-card-title">
                <strong>{role.name}</strong>
                {role.isSystem && <small>Hệ thống</small>}
              </span>
              <span>{role.code}</span>
              <small>
                {role.permissions?.length ?? 0} quyền · {role._count?.users ?? 0} người dùng
              </small>
            </button>
          ))}
        </div>
      </section>
      <section className="panel permission-workspace">
        <div className="panel-head wrap">
          <div>
            <h2>Ma trận quyền</h2>
            <p>{selectedRole ? `${selectedRole.name} · ${selectedRole.code}` : "Chưa chọn vai trò"}</p>
          </div>
          <button className="primary-button compact" type="button" disabled={!selectedRole || !hasChanges || saving} onClick={() => void save()}>
            {saving && <Loader2 className="spin" size={15} />}
            Lưu quyền
          </button>
        </div>
        {!selectedRole ? (
          <p className="empty-text">Chọn một vai trò ở danh sách bên trái để bắt đầu cấu hình.</p>
        ) : (
          <>
            <div className="permission-summary">
              <div>
                <strong>{permissionIds.length}</strong>
                <span>quyền đang chọn trên tổng {permissions.data?.length ?? 0}</span>
              </div>
              {hasChanges ? <span className="dirty-note">Có thay đổi chưa lưu</span> : <span className="status-chip">Đã đồng bộ</span>}
            </div>
            <div className="permission-insights" data-testid="role-permission-preview">
              {permissionScope.map((item) => (
                <div key={item.label}>
                  <small>{item.label}</small>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            {permissionWarnings.length > 0 && (
              <div className="permission-warnings" data-testid="role-permission-warnings">
                <strong>Cảnh báo cấu hình quyền</strong>
                {permissionWarnings.map((warning) => (
                  <span key={warning}>{warning}</span>
                ))}
              </div>
            )}
            <div className="permission-actions">
              <button
                className="ghost-button compact"
                type="button"
                onClick={() => setPermissionIds((permissions.data ?? []).map((permission) => permission.id))}
              >
                Chọn tất cả
              </button>
              <button className="ghost-button compact" type="button" onClick={() => setPermissionIds([])}>
                Bỏ chọn
              </button>
              <button className="ghost-button compact" type="button" disabled={!hasChanges} onClick={resetPermissions}>
                Khôi phục
              </button>
              <label className="copy-role">
                Sao chép từ vai trò
                <select value={copySource} onChange={(event) => setCopySource(event.target.value)}>
                  <option value="">Chọn vai trò nguồn</option>
                  {(data ?? [])
                    .filter((role) => role.id !== selected)
                    .map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                </select>
              </label>
              <button className="ghost-button compact" type="button" disabled={!copySource} onClick={copyPermissionsFromRole}>
                Sao chép
              </button>
            </div>
            {saveError && <p className="form-error">{saveError}</p>}
            <div className="permission-matrix">
              {groupedPermissions.map((group) => {
                const groupIds = group.items.map((permission) => permission.id);
                const checkedCount = groupIds.filter((permissionId) => selectedPermissionSet.has(permissionId)).length;
                const allChecked = groupIds.length > 0 && checkedCount === groupIds.length;
                return (
                  <section className="permission-group" key={group.group}>
                    <div className="permission-group-head">
                      <label className="toggle-line">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          onChange={(event) => setPermissionGroup(groupIds, event.target.checked)}
                        />
                        <strong>{group.label}</strong>
                      </label>
                      <span>
                        {checkedCount}/{groupIds.length}
                      </span>
                    </div>
                    <div className="permission-rows">
                      {group.items.map((permission) => (
                        <label className="permission-row" key={permission.id}>
                          <input
                            type="checkbox"
                            checked={selectedPermissionSet.has(permission.id)}
                            onChange={(event) => setPermission(permission.id, event.target.checked)}
                          />
                          <span>
                            <strong>{permissionActionName(permission.code)}</strong>
                            <small>{permission.code}</small>
                          </span>
                          <em>{permission.description || permission.name}</em>
                        </label>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </section>
    </section>
  );
}

export function LogsPage() {
  const { data, loading, error } = useAsyncData(() => api.activityLogs(), []);
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Nhật ký hoạt động</h2>
      </div>
      <DataTable
        columns={["Thời gian", "Người thao tác", "Hành động", "Đối tượng"]}
        rows={(data?.data ?? []).map((log) => ({
          key: log.id,
          cells: [formatDate(log.createdAt), log.actor?.fullName, log.action, `${log.entityType}:${log.entityId ?? ""}`]
        }))}
      />
    </section>
  );
}

const emptyCategoryForm = { code: "", name: "", description: "" };
const emptyTagForm = { name: "", color: "#2563eb" };
const emptySharedCatalogForm = {
  code: "",
  name: "",
  description: "",
  status: "ACTIVE",
  scopeDepartmentId: "",
  managerId: "",
  fieldsText: "code|Mã|SHORT_TEXT|required\nname|Tên|SHORT_TEXT|required"
};
const emptySharedCatalogItemForm = { catalogId: "", code: "", name: "", status: "ACTIVE", scopeDepartmentId: "", managerId: "" };

function parseSharedCatalogFields(value: string) {
  return value
    .split(/\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row, index) => {
      const [rawCode = "", rawName = "", rawType = "SHORT_TEXT", rawRequired = ""] = row.split("|").map((part) => part.trim());
      return {
        code: rawCode,
        name: rawName || rawCode,
        type: rawType || "SHORT_TEXT",
        isRequired: rawRequired === "required" || rawRequired === "true" || rawRequired === "bat_buoc",
        displayOrder: index + 1
      };
    });
}

function formatSharedCatalogFields(fields: Record<string, any>[] | undefined) {
  return (fields ?? [])
    .slice()
    .sort((left, right) => Number(left.displayOrder ?? 0) - Number(right.displayOrder ?? 0))
    .map((field) => [field.code, field.name, field.type ?? "SHORT_TEXT", field.isRequired ? "required" : ""].join("|").replace(/\|$/, ""))
    .join("\n");
}

function escapeCsvValue(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CatalogsPage() {
  const categories = useAsyncData(() => api.taskCategories(), []);
  const tags = useAsyncData(() => api.tags(), []);
  const sharedCatalogs = useAsyncData(() => api.sharedCatalogs().catch(() => []), []);
  const departments = useAsyncData(() => api.departments().catch(() => []), []);
  const users = useAsyncData(() => api.users().catch(() => ({ data: [] })), []);
  const [categoryForm, setCategoryForm] = useState({ ...emptyCategoryForm });
  const [tagForm, setTagForm] = useState({ ...emptyTagForm });
  const [sharedCatalogForm, setSharedCatalogForm] = useState({ ...emptySharedCatalogForm });
  const [sharedCatalogItemForm, setSharedCatalogItemForm] = useState({ ...emptySharedCatalogItemForm });
  const [sharedCatalogImportForm, setSharedCatalogImportForm] = useState({ catalogId: "", csv: "" });
  const [sharedCatalogImportFileName, setSharedCatalogImportFileName] = useState("");
  const [sharedCatalogImportPreview, setSharedCatalogImportPreview] = useState<Record<string, any> | null>(null);
  const [sharedCatalogKeyword, setSharedCatalogKeyword] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const [editingCategory, setEditingCategory] = useState({ ...emptyCategoryForm });
  const [editingTagId, setEditingTagId] = useState("");
  const [editingTag, setEditingTag] = useState({ ...emptyTagForm });
  const [editingSharedCatalogId, setEditingSharedCatalogId] = useState("");
  const [editingSharedCatalog, setEditingSharedCatalog] = useState({ ...emptySharedCatalogForm });
  const [editingSharedCatalogItemId, setEditingSharedCatalogItemId] = useState("");
  const [editingSharedCatalogItem, setEditingSharedCatalogItem] = useState({ ...emptySharedCatalogItemForm });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");

  const departmentOptions = departments.data ?? [];
  const userOptions = users.data?.data ?? [];
  const filteredSharedCatalogs = useMemo(() => {
    const keyword = sharedCatalogKeyword.trim().toLowerCase();
    if (!keyword) return sharedCatalogs.data ?? [];
    return (sharedCatalogs.data ?? []).filter((catalog) => {
      const haystack = [
        catalog.code,
        catalog.name,
        catalog.description,
        catalog.status,
        catalog.scopeDepartment?.name,
        catalog.manager?.fullName,
        ...(catalog.items ?? []).flatMap((item: Record<string, any>) => [item.code, item.name, item.status, item.scopeDepartment?.name, item.manager?.fullName])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [sharedCatalogKeyword, sharedCatalogs.data]);

  const loading = categories.loading || tags.loading || sharedCatalogs.loading || departments.loading || users.loading;
  const error = categories.error || tags.error || sharedCatalogs.error || departments.error || users.error;

  async function reloadCatalogs() {
    await Promise.all([categories.reload(), tags.reload(), sharedCatalogs.reload()]);
  }

  function exportSharedCatalogsCsv() {
    const rows: unknown[][] = [
      ["catalog_code", "catalog_name", "catalog_status", "scope_department", "manager", "item_code", "item_name", "item_status", "item_scope_department", "item_manager"]
    ];
    for (const catalog of filteredSharedCatalogs) {
      const items = catalog.items?.length ? catalog.items : [null];
      for (const item of items) {
        rows.push([
          catalog.code,
          catalog.name,
          catalog.status,
          catalog.scopeDepartment?.name ?? "",
          catalog.manager?.fullName ?? "",
          item?.code ?? "",
          item?.name ?? "",
          item?.status ?? "",
          item?.scopeDepartment?.name ?? "",
          item?.manager?.fullName ?? ""
        ]);
      }
    }
    downloadCsv(`shared-catalogs-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  async function handleSharedCatalogImportFile(file?: File) {
    if (!file) return;
    if (file.size > 1_000_000) {
      setFormError("File import catalog toi da 1MB.");
      return;
    }
    const text = await file.text();
    setSharedCatalogImportForm((current) => ({ ...current, csv: text }));
    setSharedCatalogImportFileName(file.name);
    setSharedCatalogImportPreview(null);
  }

  async function previewSharedCatalogImport() {
    if (!sharedCatalogImportForm.catalogId || !sharedCatalogImportForm.csv.trim()) {
      setFormError("Vui long chon catalog va nhap CSV import.");
      return;
    }
    setBusy("shared-catalog-import-preview");
    setMessage("");
    setFormError("");
    try {
      const preview = await api.importSharedCatalogItems(sharedCatalogImportForm.catalogId, { csv: sharedCatalogImportForm.csv, apply: false });
      setSharedCatalogImportPreview(preview);
      setMessage("Da doc preview import catalog.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Khong doc duoc CSV import.");
    } finally {
      setBusy("");
    }
  }

  async function applySharedCatalogImport() {
    if (!sharedCatalogImportForm.catalogId || !sharedCatalogImportForm.csv.trim() || !sharedCatalogImportPreview?.canApply) return;
    setBusy("shared-catalog-import-apply");
    setMessage("");
    setFormError("");
    try {
      const result = await api.importSharedCatalogItems(sharedCatalogImportForm.catalogId, { csv: sharedCatalogImportForm.csv, apply: true });
      setSharedCatalogImportPreview(result);
      setMessage(`Da import ${result.applied ?? 0} gia tri catalog.`);
      await reloadCatalogs();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Khong import duoc gia tri catalog.");
    } finally {
      setBusy("");
    }
  }

  async function submitCategory(event: FormEvent) {
    event.preventDefault();
    setBusy("category-create");
    setMessage("");
    setFormError("");
    try {
      await api.createTaskCategory({
        code: categoryForm.code,
        name: categoryForm.name,
        description: categoryForm.description || undefined
      });
      setCategoryForm({ ...emptyCategoryForm });
      setMessage("Đã tạo danh mục công việc.");
      await reloadCatalogs();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Không lưu được danh mục công việc.");
    } finally {
      setBusy("");
    }
  }

  async function submitTag(event: FormEvent) {
    event.preventDefault();
    setBusy("tag-create");
    setMessage("");
    setFormError("");
    try {
      await api.createTag({ name: tagForm.name, color: tagForm.color || undefined });
      setTagForm({ ...emptyTagForm });
      setMessage("Đã tạo nhãn công việc.");
      await reloadCatalogs();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Không lưu được nhãn công việc.");
    } finally {
      setBusy("");
    }
  }

  async function submitSharedCatalog(event: FormEvent) {
    event.preventDefault();
    setBusy("shared-catalog-create");
    setMessage("");
    setFormError("");
    try {
      await api.createSharedCatalog({
        code: sharedCatalogForm.code,
        name: sharedCatalogForm.name,
        description: sharedCatalogForm.description || undefined,
        status: sharedCatalogForm.status,
        scopeDepartmentId: sharedCatalogForm.scopeDepartmentId || null,
        managerId: sharedCatalogForm.managerId || null,
        fields: parseSharedCatalogFields(sharedCatalogForm.fieldsText)
      });
      setSharedCatalogForm({ ...emptySharedCatalogForm });
      setMessage("Da tao danh muc tuy chinh.");
      await reloadCatalogs();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Khong tao duoc danh muc tuy chinh.");
    } finally {
      setBusy("");
    }
  }

  async function submitSharedCatalogItem(event: FormEvent) {
    event.preventDefault();
    if (!sharedCatalogItemForm.catalogId) {
      setFormError("Vui long chon danh muc tuy chinh.");
      return;
    }
    setBusy("shared-catalog-item-create");
    setMessage("");
    setFormError("");
    try {
      await api.createSharedCatalogItem(sharedCatalogItemForm.catalogId, {
        code: sharedCatalogItemForm.code,
        name: sharedCatalogItemForm.name,
        status: sharedCatalogItemForm.status,
        scopeDepartmentId: sharedCatalogItemForm.scopeDepartmentId || null,
        managerId: sharedCatalogItemForm.managerId || null
      });
      setSharedCatalogItemForm({ ...emptySharedCatalogItemForm });
      setMessage("Da them gia tri danh muc tuy chinh.");
      await reloadCatalogs();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Khong tao duoc gia tri danh muc.");
    } finally {
      setBusy("");
    }
  }

  function editSharedCatalog(catalog: Record<string, any>) {
    setEditingSharedCatalogId(catalog.id);
    setEditingSharedCatalog({
      code: catalog.code ?? "",
      name: catalog.name ?? "",
      description: catalog.description ?? "",
      status: catalog.status ?? "ACTIVE",
      scopeDepartmentId: catalog.scopeDepartmentId ?? catalog.scopeDepartment?.id ?? "",
      managerId: catalog.managerId ?? catalog.manager?.id ?? "",
      fieldsText: formatSharedCatalogFields(catalog.fields)
    });
  }

  function editSharedCatalogItem(item: Record<string, any>, catalogId: string) {
    setEditingSharedCatalogItemId(item.id);
    setEditingSharedCatalogItem({
      catalogId,
      code: item.code ?? "",
      name: item.name ?? "",
      status: item.status ?? "ACTIVE",
      scopeDepartmentId: item.scopeDepartmentId ?? item.scopeDepartment?.id ?? "",
      managerId: item.managerId ?? item.manager?.id ?? ""
    });
  }

  function editCategory(category: Record<string, any>) {
    setEditingCategoryId(category.id);
    setEditingCategory({
      code: category.code ?? "",
      name: category.name ?? "",
      description: category.description ?? ""
    });
  }

  function editTag(tag: Record<string, any>) {
    setEditingTagId(tag.id);
    setEditingTag({
      name: tag.name ?? "",
      color: tag.color ?? "#2563eb"
    });
  }

  async function saveCategory(id: string) {
    setBusy(`category-${id}`);
    setMessage("");
    setFormError("");
    try {
      await api.updateTaskCategory(id, {
        code: editingCategory.code,
        name: editingCategory.name,
        description: editingCategory.description || null
      });
      setEditingCategoryId("");
      setMessage("Đã cập nhật danh mục công việc.");
      await reloadCatalogs();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Không cập nhật được danh mục công việc.");
    } finally {
      setBusy("");
    }
  }

  async function saveTag(id: string) {
    setBusy(`tag-${id}`);
    setMessage("");
    setFormError("");
    try {
      await api.updateTag(id, { name: editingTag.name, color: editingTag.color || null });
      setEditingTagId("");
      setMessage("Đã cập nhật nhãn công việc.");
      await reloadCatalogs();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Không cập nhật được nhãn công việc.");
    } finally {
      setBusy("");
    }
  }

  async function saveSharedCatalog(id: string) {
    setBusy(`shared-catalog-${id}`);
    setMessage("");
    setFormError("");
    try {
      await api.updateSharedCatalog(id, {
        code: editingSharedCatalog.code,
        name: editingSharedCatalog.name,
        description: editingSharedCatalog.description || null,
        status: editingSharedCatalog.status,
        scopeDepartmentId: editingSharedCatalog.scopeDepartmentId || null,
        managerId: editingSharedCatalog.managerId || null,
        fields: parseSharedCatalogFields(editingSharedCatalog.fieldsText)
      });
      setEditingSharedCatalogId("");
      setMessage("Da cap nhat danh muc tuy chinh.");
      await reloadCatalogs();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Khong cap nhat duoc danh muc tuy chinh.");
    } finally {
      setBusy("");
    }
  }

  async function saveSharedCatalogItem(id: string) {
    setBusy(`shared-catalog-item-${id}`);
    setMessage("");
    setFormError("");
    try {
      await api.updateSharedCatalogItem(id, {
        code: editingSharedCatalogItem.code,
        name: editingSharedCatalogItem.name,
        status: editingSharedCatalogItem.status,
        scopeDepartmentId: editingSharedCatalogItem.scopeDepartmentId || null,
        managerId: editingSharedCatalogItem.managerId || null
      });
      setEditingSharedCatalogItemId("");
      setMessage("Da cap nhat gia tri danh muc.");
      await reloadCatalogs();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Khong cap nhat duoc gia tri danh muc.");
    } finally {
      setBusy("");
    }
  }

  async function deleteCategory(category: Record<string, any>) {
    if (!window.confirm(`Xóa danh mục "${category.name}" khỏi danh sách chọn? Công việc cũ vẫn giữ lịch sử danh mục.`)) return;
    setBusy(`category-delete-${category.id}`);
    setMessage("");
    setFormError("");
    try {
      await api.deleteTaskCategory(category.id);
      setMessage("Đã xóa danh mục công việc.");
      await reloadCatalogs();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Không xóa được danh mục công việc.");
    } finally {
      setBusy("");
    }
  }

  async function deleteTag(tag: Record<string, any>) {
    if (!window.confirm(`Xóa nhãn "${tag.name}" khỏi danh sách chọn? Công việc cũ vẫn giữ lịch sử nhãn.`)) return;
    setBusy(`tag-delete-${tag.id}`);
    setMessage("");
    setFormError("");
    try {
      await api.deleteTag(tag.id);
      setMessage("Đã xóa nhãn công việc.");
      await reloadCatalogs();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Không xóa được nhãn công việc.");
    } finally {
      setBusy("");
    }
  }

  async function deleteSharedCatalog(catalog: Record<string, any>) {
    if (!window.confirm(`Xoa catalog "${catalog.name}" va an cac gia tri dang dung?`)) return;
    setBusy(`shared-catalog-delete-${catalog.id}`);
    setMessage("");
    setFormError("");
    try {
      await api.deleteSharedCatalog(catalog.id);
      setMessage("Da xoa danh muc tuy chinh.");
      await reloadCatalogs();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Khong xoa duoc danh muc tuy chinh.");
    } finally {
      setBusy("");
    }
  }

  async function deleteSharedCatalogItem(item: Record<string, any>) {
    if (!window.confirm(`Xoa gia tri "${item.name}" khoi catalog?`)) return;
    setBusy(`shared-catalog-item-delete-${item.id}`);
    setMessage("");
    setFormError("");
    try {
      await api.deleteSharedCatalogItem(item.id);
      setMessage("Da xoa gia tri danh muc.");
      await reloadCatalogs();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Khong xoa duoc gia tri danh muc.");
    } finally {
      setBusy("");
    }
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;

  return (
    <section className="page-grid">
      <section className="panel">
        <div className="panel-head">
          <h2>Danh mục công việc</h2>
        </div>
        <form className="form-grid compact-form" onSubmit={submitCategory}>
          <label>
            Mã danh mục
            <input
              data-testid="catalog-category-code"
              required
              pattern="[A-Za-z0-9_-]{2,40}"
              value={categoryForm.code}
              onChange={(event) => setCategoryForm({ ...categoryForm, code: event.target.value })}
            />
          </label>
          <label>
            Tên danh mục
            <input
              data-testid="catalog-category-name"
              required
              value={categoryForm.name}
              onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
            />
          </label>
          <label className="full">
            Mô tả
            <textarea
              data-testid="catalog-category-description"
              value={categoryForm.description}
              onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })}
            />
          </label>
          <button className="primary-button full" data-testid="catalog-category-create-save" type="submit" disabled={busy === "category-create"}>
            {busy === "category-create" ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
            Tạo danh mục
          </button>
        </form>
        <DataTable
          columns={["Mã", "Tên", "Mô tả", "Cập nhật", "Thao tác"]}
          rows={(categories.data ?? []).map((category) => {
            const editing = editingCategoryId === category.id;
            return {
              key: category.id,
              testId: `catalog-category-row-${category.id}`,
              cells: [
                editing ? (
                  <input data-testid={`catalog-category-edit-code-${category.id}`} value={editingCategory.code} onChange={(event) => setEditingCategory({ ...editingCategory, code: event.target.value })} />
                ) : (
                  category.code
                ),
                editing ? (
                  <input data-testid={`catalog-category-edit-name-${category.id}`} value={editingCategory.name} onChange={(event) => setEditingCategory({ ...editingCategory, name: event.target.value })} />
                ) : (
                  category.name
                ),
                editing ? (
                  <input
                    data-testid={`catalog-category-edit-description-${category.id}`}
                    value={editingCategory.description}
                    onChange={(event) => setEditingCategory({ ...editingCategory, description: event.target.value })}
                  />
                ) : (
                  category.description ?? ""
                ),
                formatDate(category.updatedAt),
                <div className="row-actions">
                  {editing ? (
                    <>
                      <button className="primary-button compact" data-testid={`catalog-category-save-${category.id}`} type="button" disabled={busy === `category-${category.id}`} onClick={() => void saveCategory(category.id)}>
                        {busy === `category-${category.id}` ? <Loader2 className="spin" size={14} /> : <Save size={14} />}
                        Lưu
                      </button>
                      <button className="ghost-button compact" type="button" onClick={() => setEditingCategoryId("")}>
                        <XCircle size={14} />
                        Hủy
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="ghost-button compact" data-testid={`catalog-category-edit-${category.id}`} type="button" onClick={() => editCategory(category)}>
                        <Edit3 size={14} />
                        Sửa
                      </button>
                      <button className="danger-button compact" data-testid={`catalog-category-delete-${category.id}`} type="button" disabled={busy === `category-delete-${category.id}`} onClick={() => void deleteCategory(category)}>
                        {busy === `category-delete-${category.id}` ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                        Xóa
                      </button>
                    </>
                  )}
                </div>
              ]
            };
          })}
        />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Nhãn công việc</h2>
        </div>
        <form className="form-grid compact-form" onSubmit={submitTag}>
          <label>
            Tên nhãn
            <input data-testid="catalog-tag-name" required value={tagForm.name} onChange={(event) => setTagForm({ ...tagForm, name: event.target.value })} />
          </label>
          <label>
            Màu
            <input data-testid="catalog-tag-color" type="color" value={tagForm.color} onChange={(event) => setTagForm({ ...tagForm, color: event.target.value })} />
          </label>
          <button className="primary-button full" data-testid="catalog-tag-create-save" type="submit" disabled={busy === "tag-create"}>
            {busy === "tag-create" ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
            Tạo nhãn
          </button>
        </form>
        <DataTable
          columns={["Tên", "Màu", "Cập nhật", "Thao tác"]}
          rows={(tags.data ?? []).map((tag) => {
            const editing = editingTagId === tag.id;
            return {
              key: tag.id,
              testId: `catalog-tag-row-${tag.id}`,
              cells: [
                editing ? <input data-testid={`catalog-tag-edit-name-${tag.id}`} value={editingTag.name} onChange={(event) => setEditingTag({ ...editingTag, name: event.target.value })} /> : tag.name,
                editing ? (
                  <input data-testid={`catalog-tag-edit-color-${tag.id}`} type="color" value={editingTag.color} onChange={(event) => setEditingTag({ ...editingTag, color: event.target.value })} />
                ) : (
                  <span className="tag-swatch"><b style={{ background: tag.color ?? "#64748b" }} />{tag.color ?? ""}</span>
                ),
                formatDate(tag.updatedAt),
                <div className="row-actions">
                  {editing ? (
                    <>
                      <button className="primary-button compact" data-testid={`catalog-tag-save-${tag.id}`} type="button" disabled={busy === `tag-${tag.id}`} onClick={() => void saveTag(tag.id)}>
                        {busy === `tag-${tag.id}` ? <Loader2 className="spin" size={14} /> : <Save size={14} />}
                        Lưu
                      </button>
                      <button className="ghost-button compact" type="button" onClick={() => setEditingTagId("")}>
                        <XCircle size={14} />
                        Hủy
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="ghost-button compact" data-testid={`catalog-tag-edit-${tag.id}`} type="button" onClick={() => editTag(tag)}>
                        <Edit3 size={14} />
                        Sửa
                      </button>
                      <button className="danger-button compact" data-testid={`catalog-tag-delete-${tag.id}`} type="button" disabled={busy === `tag-delete-${tag.id}`} onClick={() => void deleteTag(tag)}>
                        {busy === `tag-delete-${tag.id}` ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                        Xóa
                      </button>
                    </>
                  )}
                </div>
              ]
            };
          })}
        />
      </section>
      <section className="panel wide">
        <div className="panel-head wrap">
          <h2>Danh muc tuy chinh</h2>
          <span className="status-chip">{sharedCatalogs.data?.length ?? 0} catalog</span>
        </div>
        <div className="catalog-admin-grid">
          <form className="form-grid compact-form" onSubmit={submitSharedCatalog}>
            <label>
              Ma catalog
              <input
                data-testid="shared-catalog-code"
                required
                pattern="[A-Za-z0-9_-]{2,80}"
                value={sharedCatalogForm.code}
                onChange={(event) => setSharedCatalogForm({ ...sharedCatalogForm, code: event.target.value })}
              />
            </label>
            <label>
              Ten catalog
              <input
                data-testid="shared-catalog-name"
                required
                value={sharedCatalogForm.name}
                onChange={(event) => setSharedCatalogForm({ ...sharedCatalogForm, name: event.target.value })}
              />
            </label>
            <label>
              Trang thai
              <select data-testid="shared-catalog-status" value={sharedCatalogForm.status} onChange={(event) => setSharedCatalogForm({ ...sharedCatalogForm, status: event.target.value })}>
                <option value="ACTIVE">Dang dung</option>
                <option value="INACTIVE">Tam dung</option>
              </select>
            </label>
            <label>
              Pham vi phong ban
              <select
                data-testid="shared-catalog-scope-department"
                value={sharedCatalogForm.scopeDepartmentId}
                onChange={(event) => setSharedCatalogForm({ ...sharedCatalogForm, scopeDepartmentId: event.target.value })}
              >
                <option value="">Toan cong ty</option>
                {departmentOptions.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quan ly catalog
              <select data-testid="shared-catalog-manager" value={sharedCatalogForm.managerId} onChange={(event) => setSharedCatalogForm({ ...sharedCatalogForm, managerId: event.target.value })}>
                <option value="">Chua gan</option>
                {userOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              Mo ta
              <textarea value={sharedCatalogForm.description} onChange={(event) => setSharedCatalogForm({ ...sharedCatalogForm, description: event.target.value })} />
            </label>
            <label className="full">
              Fields
              <textarea
                data-testid="shared-catalog-fields"
                rows={4}
                value={sharedCatalogForm.fieldsText}
                onChange={(event) => setSharedCatalogForm({ ...sharedCatalogForm, fieldsText: event.target.value })}
              />
              <small>Moi dong: code|Ten|SHORT_TEXT/NUMBER/CURRENCY/DATE/BOOLEAN/SELECT|required</small>
            </label>
            <button className="primary-button full" data-testid="shared-catalog-create-save" type="submit" disabled={busy === "shared-catalog-create"}>
              {busy === "shared-catalog-create" ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
              Tao catalog
            </button>
          </form>
          <form className="form-grid compact-form" onSubmit={submitSharedCatalogItem}>
            <label className="full">
              Catalog
              <select
                data-testid="shared-catalog-item-catalog"
                required
                value={sharedCatalogItemForm.catalogId}
                onChange={(event) => setSharedCatalogItemForm({ ...sharedCatalogItemForm, catalogId: event.target.value })}
              >
                <option value="">Chon catalog</option>
                {(sharedCatalogs.data ?? []).map((catalog) => (
                  <option key={catalog.id} value={catalog.id}>
                    {catalog.name} ({catalog.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ma gia tri
              <input
                data-testid="shared-catalog-item-code"
                required
                value={sharedCatalogItemForm.code}
                onChange={(event) => setSharedCatalogItemForm({ ...sharedCatalogItemForm, code: event.target.value })}
              />
            </label>
            <label>
              Ten hien thi
              <input
                data-testid="shared-catalog-item-name"
                required
                value={sharedCatalogItemForm.name}
                onChange={(event) => setSharedCatalogItemForm({ ...sharedCatalogItemForm, name: event.target.value })}
              />
            </label>
            <label>
              Trang thai
              <select data-testid="shared-catalog-item-status" value={sharedCatalogItemForm.status} onChange={(event) => setSharedCatalogItemForm({ ...sharedCatalogItemForm, status: event.target.value })}>
                <option value="ACTIVE">Dang dung</option>
                <option value="INACTIVE">Tam dung</option>
              </select>
            </label>
            <label>
              Pham vi gia tri
              <select
                data-testid="shared-catalog-item-scope-department"
                value={sharedCatalogItemForm.scopeDepartmentId}
                onChange={(event) => setSharedCatalogItemForm({ ...sharedCatalogItemForm, scopeDepartmentId: event.target.value })}
              >
                <option value="">Theo catalog</option>
                {departmentOptions.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quan ly gia tri
              <select data-testid="shared-catalog-item-manager" value={sharedCatalogItemForm.managerId} onChange={(event) => setSharedCatalogItemForm({ ...sharedCatalogItemForm, managerId: event.target.value })}>
                <option value="">Theo catalog</option>
                {userOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button full" data-testid="shared-catalog-item-create-save" type="submit" disabled={busy === "shared-catalog-item-create"}>
              {busy === "shared-catalog-item-create" ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
              Them gia tri
            </button>
          </form>
        </div>
        <section className="catalog-import-section form-stack" data-testid="shared-catalog-import-panel">
          <div className="panel-head wrap">
            <h3>Import gia tri catalog</h3>
            {sharedCatalogImportFileName && <span className="status-chip">{sharedCatalogImportFileName}</span>}
          </div>
          <div className="form-grid compact-form">
            <label>
              Catalog
              <select
                data-testid="shared-catalog-import-catalog"
                value={sharedCatalogImportForm.catalogId}
                onChange={(event) => {
                  setSharedCatalogImportForm({ ...sharedCatalogImportForm, catalogId: event.target.value });
                  setSharedCatalogImportPreview(null);
                }}
              >
                <option value="">Chon catalog</option>
                {(sharedCatalogs.data ?? []).map((catalog) => (
                  <option key={catalog.id} value={catalog.id}>
                    {catalog.name} ({catalog.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              File CSV
              <input data-testid="shared-catalog-import-file" type="file" accept=".csv,text/csv" onChange={(event) => void handleSharedCatalogImportFile(event.currentTarget.files?.[0])} />
            </label>
            <label className="full">
              Noi dung CSV
              <textarea
                data-testid="shared-catalog-import-csv"
                rows={4}
                placeholder="code,name,status,departmentCode,managerEmployeeCode"
                value={sharedCatalogImportForm.csv}
                onChange={(event) => {
                  setSharedCatalogImportForm({ ...sharedCatalogImportForm, csv: event.target.value });
                  setSharedCatalogImportPreview(null);
                }}
              />
              <small>Header ho tro: code,name,status,departmentCode,managerEmployeeCode.</small>
            </label>
          </div>
          {sharedCatalogImportPreview && (
            <div className="stack-list" data-testid="shared-catalog-import-summary">
              <span>
                Tong dong <strong>{sharedCatalogImportPreview.summary?.total ?? 0}</strong>
              </span>
              <span>
                Hop le <strong>{sharedCatalogImportPreview.summary?.valid ?? 0}</strong>
              </span>
              <span>
                Loi <strong>{sharedCatalogImportPreview.summary?.invalid ?? 0}</strong>
              </span>
              {typeof sharedCatalogImportPreview.applied === "number" && sharedCatalogImportPreview.applied > 0 && (
                <span>
                  Da import <strong>{sharedCatalogImportPreview.applied}</strong>
                </span>
              )}
            </div>
          )}
          {sharedCatalogImportPreview?.rows?.length ? (
            <DataTable
              columns={["Dong", "Ma", "Ten", "Trang thai", "Loi"]}
              rows={sharedCatalogImportPreview.rows.slice(0, 6).map((row: Record<string, any>) => ({
                key: String(row.rowNumber),
                testId: `shared-catalog-import-row-${row.rowNumber}`,
                cells: [row.rowNumber, row.code, row.name, row.status, row.errors?.join("; ") || "OK"]
              }))}
            />
          ) : null}
          <div className="row-actions">
            <button
              className="ghost-button"
              data-testid="shared-catalog-import-preview"
              type="button"
              disabled={!sharedCatalogImportForm.catalogId || !sharedCatalogImportForm.csv.trim() || busy === "shared-catalog-import-preview"}
              onClick={() => void previewSharedCatalogImport()}
            >
              {busy === "shared-catalog-import-preview" ? <Loader2 className="spin" size={16} /> : <Upload size={16} />}
              Xem truoc
            </button>
            <button
              className="primary-button"
              data-testid="shared-catalog-import-apply"
              type="button"
              disabled={!sharedCatalogImportPreview?.canApply || busy === "shared-catalog-import-apply"}
              onClick={() => void applySharedCatalogImport()}
            >
              {busy === "shared-catalog-import-apply" ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
              Import
            </button>
          </div>
        </section>
        <div className="toolbar wrap">
          <label className="search-inline">
            Tim catalog
            <input
              data-testid="shared-catalog-search"
              placeholder="Ma, ten, phong ban, quan ly..."
              value={sharedCatalogKeyword}
              onChange={(event) => setSharedCatalogKeyword(event.target.value)}
            />
          </label>
          <button className="ghost-button compact" data-testid="shared-catalog-export-csv" type="button" onClick={exportSharedCatalogsCsv}>
            <Download size={16} />
            Xuat CSV
          </button>
          <span className="status-chip">{filteredSharedCatalogs.length}/{sharedCatalogs.data?.length ?? 0}</span>
        </div>
        <DataTable
          columns={["Ma", "Ten", "Trang thai", "Pham vi", "Quan ly", "Fields", "Items", "Thao tac"]}
          rows={filteredSharedCatalogs.map((catalog) => {
            const editing = editingSharedCatalogId === catalog.id;
            return {
              key: catalog.id,
              testId: `shared-catalog-row-${catalog.id}`,
              cells: [
                editing ? (
                  <input data-testid={`shared-catalog-edit-code-${catalog.id}`} value={editingSharedCatalog.code} onChange={(event) => setEditingSharedCatalog({ ...editingSharedCatalog, code: event.target.value })} />
                ) : (
                  catalog.code
                ),
                editing ? (
                  <input data-testid={`shared-catalog-edit-name-${catalog.id}`} value={editingSharedCatalog.name} onChange={(event) => setEditingSharedCatalog({ ...editingSharedCatalog, name: event.target.value })} />
                ) : (
                  catalog.name
                ),
                editing ? (
                  <select data-testid={`shared-catalog-edit-status-${catalog.id}`} value={editingSharedCatalog.status} onChange={(event) => setEditingSharedCatalog({ ...editingSharedCatalog, status: event.target.value })}>
                    <option value="ACTIVE">Dang dung</option>
                    <option value="INACTIVE">Tam dung</option>
                  </select>
                ) : (
                  statusLabels[catalog.status] ?? catalog.status
                ),
                editing ? (
                  <select
                    data-testid={`shared-catalog-edit-scope-department-${catalog.id}`}
                    value={editingSharedCatalog.scopeDepartmentId}
                    onChange={(event) => setEditingSharedCatalog({ ...editingSharedCatalog, scopeDepartmentId: event.target.value })}
                  >
                    <option value="">Toan cong ty</option>
                    {departmentOptions.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  catalog.scopeDepartment?.name ?? "Toan cong ty"
                ),
                editing ? (
                  <select data-testid={`shared-catalog-edit-manager-${catalog.id}`} value={editingSharedCatalog.managerId} onChange={(event) => setEditingSharedCatalog({ ...editingSharedCatalog, managerId: event.target.value })}>
                    <option value="">Chua gan</option>
                    {userOptions.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName}
                      </option>
                    ))}
                  </select>
                ) : (
                  catalog.manager?.fullName ?? "Chua gan"
                ),
                editing ? (
                  <textarea
                    data-testid={`shared-catalog-edit-fields-${catalog.id}`}
                    rows={4}
                    value={editingSharedCatalog.fieldsText}
                    onChange={(event) => setEditingSharedCatalog({ ...editingSharedCatalog, fieldsText: event.target.value })}
                  />
                ) : (
                  catalog.fields?.length ?? 0
                ),
                <div className="catalog-item-list">
                  {(catalog.items ?? []).map((item: Record<string, any>) => {
                    const editingItem = editingSharedCatalogItemId === item.id;
                    return (
                      <div className="catalog-item-row" data-testid={`shared-catalog-item-row-${item.id}`} key={item.id}>
                        {editingItem ? (
                          <>
                            <input data-testid={`shared-catalog-item-edit-code-${item.id}`} value={editingSharedCatalogItem.code} onChange={(event) => setEditingSharedCatalogItem({ ...editingSharedCatalogItem, code: event.target.value })} />
                            <input data-testid={`shared-catalog-item-edit-name-${item.id}`} value={editingSharedCatalogItem.name} onChange={(event) => setEditingSharedCatalogItem({ ...editingSharedCatalogItem, name: event.target.value })} />
                            <select data-testid={`shared-catalog-item-edit-status-${item.id}`} value={editingSharedCatalogItem.status} onChange={(event) => setEditingSharedCatalogItem({ ...editingSharedCatalogItem, status: event.target.value })}>
                              <option value="ACTIVE">Dang dung</option>
                              <option value="INACTIVE">Tam dung</option>
                            </select>
                            <select
                              data-testid={`shared-catalog-item-edit-scope-department-${item.id}`}
                              value={editingSharedCatalogItem.scopeDepartmentId}
                              onChange={(event) => setEditingSharedCatalogItem({ ...editingSharedCatalogItem, scopeDepartmentId: event.target.value })}
                            >
                              <option value="">Theo catalog</option>
                              {departmentOptions.map((department) => (
                                <option key={department.id} value={department.id}>
                                  {department.name}
                                </option>
                              ))}
                            </select>
                            <select
                              data-testid={`shared-catalog-item-edit-manager-${item.id}`}
                              value={editingSharedCatalogItem.managerId}
                              onChange={(event) => setEditingSharedCatalogItem({ ...editingSharedCatalogItem, managerId: event.target.value })}
                            >
                              <option value="">Theo catalog</option>
                              {userOptions.map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.fullName}
                                </option>
                              ))}
                            </select>
                            <button className="primary-button compact" data-testid={`shared-catalog-item-save-${item.id}`} type="button" disabled={busy === `shared-catalog-item-${item.id}`} onClick={() => void saveSharedCatalogItem(item.id)}>
                              {busy === `shared-catalog-item-${item.id}` ? <Loader2 className="spin" size={14} /> : <Save size={14} />}
                              Luu
                            </button>
                            <button className="ghost-button compact" data-testid={`shared-catalog-item-cancel-${item.id}`} type="button" onClick={() => setEditingSharedCatalogItemId("")}>
                              <XCircle size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <span>
                              <strong>{item.code}</strong> - {item.name}
                            </span>
                            <span className="status-chip">{statusLabels[item.status] ?? item.status}</span>
                            <span>{item.scopeDepartment?.name ?? "Theo catalog"}</span>
                            <span>{item.manager?.fullName ?? "Theo catalog"}</span>
                            <button className="ghost-button compact" data-testid={`shared-catalog-item-edit-${item.id}`} type="button" onClick={() => editSharedCatalogItem(item, catalog.id)}>
                              <Edit3 size={14} />
                              Sua
                            </button>
                            <button className="danger-button compact" data-testid={`shared-catalog-item-delete-${item.id}`} type="button" disabled={busy === `shared-catalog-item-delete-${item.id}`} onClick={() => void deleteSharedCatalogItem(item)}>
                              {busy === `shared-catalog-item-delete-${item.id}` ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                              Xoa
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                  {(catalog.items ?? []).length === 0 && <span className="empty-text">Chua co gia tri.</span>}
                </div>,
                <div className="row-actions">
                  {editing ? (
                    <>
                      <button className="primary-button compact" data-testid={`shared-catalog-save-${catalog.id}`} type="button" disabled={busy === `shared-catalog-${catalog.id}`} onClick={() => void saveSharedCatalog(catalog.id)}>
                        {busy === `shared-catalog-${catalog.id}` ? <Loader2 className="spin" size={14} /> : <Save size={14} />}
                        Luu
                      </button>
                      <button className="ghost-button compact" data-testid={`shared-catalog-cancel-${catalog.id}`} type="button" onClick={() => setEditingSharedCatalogId("")}>
                        <XCircle size={14} />
                        Huy
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="ghost-button compact" data-testid={`shared-catalog-edit-${catalog.id}`} type="button" onClick={() => editSharedCatalog(catalog)}>
                        <Edit3 size={14} />
                        Sua
                      </button>
                      <button className="danger-button compact" data-testid={`shared-catalog-delete-${catalog.id}`} type="button" disabled={busy === `shared-catalog-delete-${catalog.id}`} onClick={() => void deleteSharedCatalog(catalog)}>
                        {busy === `shared-catalog-delete-${catalog.id}` ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                        Xoa
                      </button>
                    </>
                  )}
                </div>
              ]
            };
          })}
        />
      </section>
      {(message || formError) && (
        <section className="panel wide compact-status" role={formError ? "alert" : "status"} data-testid="catalog-message">
          {formError || message}
        </section>
      )}
    </section>
  );
}

function settingValue(data: Record<string, any>[] | null, key: string, fallback: string) {
  const raw = data?.find((setting) => setting.key === key)?.value;
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  return fallback;
}

function settingBooleanValue(data: Record<string, any>[] | null, key: string, fallback: boolean) {
  const raw = data?.find((setting) => setting.key === key)?.value;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") return raw.trim().toLowerCase() === "true";
  return fallback;
}

function parseSettingValue(value: string) {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

const defaultFileUploadMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "video/mp4"
];

export function SettingsPage() {
  const { data, loading, error, reload } = useAsyncData(() => api.settings(), []);
  const [form, setForm] = useState({ key: "task.redo.reset_progress", value: "false", description: "" });
  const [taskConfigForm, setTaskConfigForm] = useState({ redoResetProgress: false });
  const [autoCodeForm, setAutoCodeForm] = useState({
    taskPrefix: "TASK",
    taskPadding: "4",
    workflowPrefix: "WF",
    workflowPadding: "4"
  });
  const [workflowConfigForm, setWorkflowConfigForm] = useState({
    autoActivateTemplate: true,
    defaultDeadlineAmount: "1",
    defaultDeadlineUnit: "DAY",
    defaultReminderBeforeHours: "24",
    defaultApprovalMode: "SEQUENTIAL",
    defaultCompletionRule: "ALL"
  });
  const [fileConfigForm, setFileConfigForm] = useState({
    maxMb: "20",
    mimeTypes: defaultFileUploadMimeTypes.join("\n")
  });
  const [opsConfigForm, setOpsConfigForm] = useState({
    inAppNotifications: true,
    pushNotifications: false,
    emailNotifications: false,
    deadlineReminderHours: "24",
    smtpHost: "",
    smtpPort: "587",
    smtpFrom: "no-reply@workflow.local",
    smtpTls: true,
    maxFailedLogins: "5",
    lockMinutes: "15",
    backupSchedule: "0 2 * * *",
    backupRetentionDays: "30",
    backupUploads: true
  });
  const [saving, setSaving] = useState("");
  const [settingMessage, setSettingMessage] = useState("");
  const [settingError, setSettingError] = useState("");

  useEffect(() => {
    if (!data) return;
    setAutoCodeForm({
      taskPrefix: settingValue(data, "auto_code.task.prefix", "TASK"),
      taskPadding: settingValue(data, "auto_code.task.padding", "4"),
      workflowPrefix: settingValue(data, "auto_code.workflow_instance.prefix", "WF"),
      workflowPadding: settingValue(data, "auto_code.workflow_instance.padding", "4")
    });
    setTaskConfigForm({
      redoResetProgress: settingBooleanValue(data, "task.redo.reset_progress", false)
    });
    setWorkflowConfigForm({
      autoActivateTemplate: settingBooleanValue(data, "workflow.template.auto_activate", true),
      defaultDeadlineAmount: settingValue(data, "workflow.step.default_deadline_amount", "1"),
      defaultDeadlineUnit: settingValue(data, "workflow.step.default_deadline_unit", "DAY"),
      defaultReminderBeforeHours: settingValue(data, "workflow.step.default_reminder_before_hours", "24"),
      defaultApprovalMode: settingValue(data, "workflow.step.default_approval_mode", "SEQUENTIAL"),
      defaultCompletionRule: settingValue(data, "workflow.step.default_completion_rule", "ALL")
    });
    const rawMimeTypes = data.find((setting) => setting.key === "file.upload.allowed_mime_types")?.value;
    setFileConfigForm({
      maxMb: settingValue(data, "file.upload.max_mb", "20"),
      mimeTypes: Array.isArray(rawMimeTypes)
        ? rawMimeTypes.filter((item): item is string => typeof item === "string").join("\n")
        : typeof rawMimeTypes === "string"
          ? rawMimeTypes
          : defaultFileUploadMimeTypes.join("\n")
    });
    setOpsConfigForm({
      inAppNotifications: settingBooleanValue(data, "notification.in_app.enabled", true),
      pushNotifications: settingBooleanValue(data, "notification.push.enabled", false),
      emailNotifications: settingBooleanValue(data, "notification.email.enabled", false),
      deadlineReminderHours: settingValue(data, "notification.deadline_reminder_hours", "24"),
      smtpHost: settingValue(data, "email.smtp.host", ""),
      smtpPort: settingValue(data, "email.smtp.port", "587"),
      smtpFrom: settingValue(data, "email.from_address", "no-reply@workflow.local"),
      smtpTls: settingBooleanValue(data, "email.smtp.tls", true),
      maxFailedLogins: settingValue(data, "security.login.max_failed_attempts", "5"),
      lockMinutes: settingValue(data, "security.login.lock_minutes", "15"),
      backupSchedule: settingValue(data, "backup.database.schedule", "0 2 * * *"),
      backupRetentionDays: settingValue(data, "backup.retention_days", "30"),
      backupUploads: settingBooleanValue(data, "backup.uploads.enabled", true)
    });
  }, [data]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving("generic");
    setSettingMessage("");
    setSettingError("");
    try {
      await api.saveSetting({ key: form.key, value: parseSettingValue(form.value), description: form.description });
      setSettingMessage("Đã lưu cấu hình.");
      await reload();
    } catch (err) {
      setSettingError(err instanceof Error ? err.message : "Không lưu được cấu hình.");
    } finally {
      setSaving("");
    }
  }

  async function saveTaskConfig(event: FormEvent) {
    event.preventDefault();
    setSaving("task-config");
    setSettingMessage("");
    setSettingError("");
    try {
      await api.saveSetting({
        key: "task.redo.reset_progress",
        value: taskConfigForm.redoResetProgress,
        description: "Có đặt lại tiến độ khi yêu cầu thực hiện lại hay không."
      });
      setSettingMessage("Đã lưu cấu hình công việc.");
      await reload();
    } catch (err) {
      setSettingError(err instanceof Error ? err.message : "Không lưu được cấu hình công việc.");
    } finally {
      setSaving("");
    }
  }

  async function saveAutoCode(event: FormEvent) {
    event.preventDefault();
    setSaving("auto-code");
    setSettingMessage("");
    setSettingError("");
    try {
      await Promise.all([
        api.saveSetting({
          key: "auto_code.task.prefix",
          value: autoCodeForm.taskPrefix.trim().toUpperCase(),
          description: "Tiền tố mã công việc tự sinh."
        }),
        api.saveSetting({
          key: "auto_code.task.padding",
          value: Number(autoCodeForm.taskPadding),
          description: "Số chữ số thứ tự trong mã công việc."
        }),
        api.saveSetting({
          key: "auto_code.workflow_instance.prefix",
          value: autoCodeForm.workflowPrefix.trim().toUpperCase(),
          description: "Tiền tố mã hồ sơ quy trình tự sinh."
        }),
        api.saveSetting({
          key: "auto_code.workflow_instance.padding",
          value: Number(autoCodeForm.workflowPadding),
          description: "Số chữ số thứ tự trong mã hồ sơ quy trình."
        })
      ]);
      setSettingMessage("Đã lưu cấu hình mã tự động.");
      await reload();
    } catch (err) {
      setSettingError(err instanceof Error ? err.message : "Không lưu được cấu hình mã tự động.");
    } finally {
      setSaving("");
    }
  }

  async function saveWorkflowConfig(event: FormEvent) {
    event.preventDefault();
    setSaving("workflow-config");
    setSettingMessage("");
    setSettingError("");
    const deadlineAmount = Number(workflowConfigForm.defaultDeadlineAmount);
    const reminderBeforeHours = Number(workflowConfigForm.defaultReminderBeforeHours);
    const deadlineUnits = new Set(["HOUR", "DAY"]);
    const approvalModes = new Set(["SEQUENTIAL", "PARALLEL"]);
    const completionRules = new Set(["ALL", "ANY", "MIN_COUNT", "MIN_PERCENT"]);
    if (
      !Number.isFinite(deadlineAmount) ||
      deadlineAmount < 0 ||
      !Number.isFinite(reminderBeforeHours) ||
      reminderBeforeHours < 0 ||
      !deadlineUnits.has(workflowConfigForm.defaultDeadlineUnit) ||
      !approvalModes.has(workflowConfigForm.defaultApprovalMode) ||
      !completionRules.has(workflowConfigForm.defaultCompletionRule)
    ) {
      setSaving("");
      setSettingError("Vui lòng nhập cấu hình quy trình hợp lệ.");
      return;
    }
    try {
      await Promise.all([
        api.saveSetting({
          key: "workflow.template.auto_activate",
          value: workflowConfigForm.autoActivateTemplate,
          description: "Tự động kích hoạt phiên bản mẫu quy trình khi tạo từ builder."
        }),
        api.saveSetting({
          key: "workflow.step.default_deadline_amount",
          value: Math.floor(deadlineAmount),
          description: "Số giờ/ngày xử lý mặc định cho bước quy trình mới."
        }),
        api.saveSetting({
          key: "workflow.step.default_deadline_unit",
          value: workflowConfigForm.defaultDeadlineUnit,
          description: "Đơn vị hạn xử lý mặc định cho bước quy trình mới."
        }),
        api.saveSetting({
          key: "workflow.step.default_reminder_before_hours",
          value: Math.floor(reminderBeforeHours),
          description: "Số giờ nhắc trước hạn mặc định cho bước quy trình mới."
        }),
        api.saveSetting({
          key: "workflow.step.default_approval_mode",
          value: workflowConfigForm.defaultApprovalMode,
          description: "Kiểu duyệt mặc định cho bước quy trình mới."
        }),
        api.saveSetting({
          key: "workflow.step.default_completion_rule",
          value: workflowConfigForm.defaultCompletionRule,
          description: "Điều kiện hoàn thành mặc định cho bước quy trình mới."
        })
      ]);
      setSettingMessage("Đã lưu cấu hình quy trình.");
      await reload();
    } catch (err) {
      setSettingError(err instanceof Error ? err.message : "Không lưu được cấu hình quy trình.");
    } finally {
      setSaving("");
    }
  }

  async function saveFileConfig(event: FormEvent) {
    event.preventDefault();
    setSaving("file-config");
    setSettingMessage("");
    setSettingError("");
    const maxMb = Number(fileConfigForm.maxMb);
    const mimeTypes = [
      ...new Set(
        fileConfigForm.mimeTypes
          .split(/[\s,;]+/)
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
      )
    ];
    if (!Number.isFinite(maxMb) || maxMb < 1) {
      setSaving("");
      setSettingError("Dung lượng upload phải lớn hơn hoặc bằng 1 MB.");
      return;
    }
    if (mimeTypes.length === 0) {
      setSaving("");
      setSettingError("Vui lòng nhập ít nhất một MIME type được phép.");
      return;
    }
    try {
      await Promise.all([
        api.saveSetting({
          key: "file.upload.max_mb",
          value: Math.floor(maxMb),
          description: "Dung lượng tệp upload tối đa tính bằng MB, không vượt quá trần MAX_UPLOAD_MB."
        }),
        api.saveSetting({
          key: "file.upload.allowed_mime_types",
          value: mimeTypes,
          description: "Danh sách MIME type được phép upload cho task và workflow."
        })
      ]);
      setSettingMessage("Đã lưu cấu hình tệp upload.");
      await reload();
    } catch (err) {
      setSettingError(err instanceof Error ? err.message : "Không lưu được cấu hình tệp upload.");
    } finally {
      setSaving("");
    }
  }

  async function saveOpsConfig(event: FormEvent) {
    event.preventDefault();
    setSaving("ops-config");
    setSettingMessage("");
    setSettingError("");
    const deadlineReminderHours = Number(opsConfigForm.deadlineReminderHours);
    const smtpPort = Number(opsConfigForm.smtpPort);
    const maxFailedLogins = Number(opsConfigForm.maxFailedLogins);
    const lockMinutes = Number(opsConfigForm.lockMinutes);
    const backupRetentionDays = Number(opsConfigForm.backupRetentionDays);
    if (
      !Number.isFinite(deadlineReminderHours) ||
      deadlineReminderHours < 1 ||
      !Number.isFinite(smtpPort) ||
      smtpPort < 1 ||
      !Number.isFinite(maxFailedLogins) ||
      maxFailedLogins < 1 ||
      !Number.isFinite(lockMinutes) ||
      lockMinutes < 1 ||
      !Number.isFinite(backupRetentionDays) ||
      backupRetentionDays < 1
    ) {
      setSaving("");
      setSettingError("Vui lòng nhập số hợp lệ cho nhắc hạn, SMTP, bảo mật và backup.");
      return;
    }
    try {
      await Promise.all([
        api.saveSetting({
          key: "notification.in_app.enabled",
          value: opsConfigForm.inAppNotifications,
          description: "Bật trung tâm thông báo trong ứng dụng."
        }),
        api.saveSetting({
          key: "notification.push.enabled",
          value: opsConfigForm.pushNotifications,
          description: "Bật khả năng gửi push notification cho mobile/desktop khi adapter được cấu hình."
        }),
        api.saveSetting({
          key: "notification.email.enabled",
          value: opsConfigForm.emailNotifications,
          description: "Bật khả năng gửi email notification khi SMTP được cấu hình."
        }),
        api.saveSetting({
          key: "notification.deadline_reminder_hours",
          value: Math.floor(deadlineReminderHours),
          description: "Số giờ nhắc trước hạn mặc định cho công việc/quy trình."
        }),
        api.saveSetting({
          key: "email.smtp.host",
          value: opsConfigForm.smtpHost.trim(),
          description: "Máy chủ SMTP dùng cho email notification."
        }),
        api.saveSetting({
          key: "email.smtp.port",
          value: Math.floor(smtpPort),
          description: "Cổng SMTP."
        }),
        api.saveSetting({
          key: "email.from_address",
          value: opsConfigForm.smtpFrom.trim(),
          description: "Địa chỉ gửi email mặc định."
        }),
        api.saveSetting({
          key: "email.smtp.tls",
          value: opsConfigForm.smtpTls,
          description: "Sử dụng TLS khi kết nối SMTP."
        }),
        api.saveSetting({
          key: "security.login.max_failed_attempts",
          value: Math.floor(maxFailedLogins),
          description: "Số lần đăng nhập sai tối đa trước khi trì hoãn/khóa."
        }),
        api.saveSetting({
          key: "security.login.lock_minutes",
          value: Math.floor(lockMinutes),
          description: "Số phút trì hoãn/khóa sau nhiều lần đăng nhập sai."
        }),
        api.saveSetting({
          key: "backup.database.schedule",
          value: opsConfigForm.backupSchedule.trim(),
          description: "Lịch backup database dạng cron."
        }),
        api.saveSetting({
          key: "backup.retention_days",
          value: Math.floor(backupRetentionDays),
          description: "Số ngày giữ bản backup."
        }),
        api.saveSetting({
          key: "backup.uploads.enabled",
          value: opsConfigForm.backupUploads,
          description: "Có backup thư mục upload cùng database hay không."
        })
      ]);
      setSettingMessage("Đã lưu cấu hình thông báo, email, bảo mật và backup.");
      await reload();
    } catch (err) {
      setSettingError(err instanceof Error ? err.message : "Không lưu được cấu hình vận hành.");
    } finally {
      setSaving("");
    }
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  return (
    <section className="page-grid">
      <form className="panel form-stack" onSubmit={submit}>
        <div className="panel-head">
          <h2>Cấu hình hệ thống</h2>
        </div>
        <label>
          Khóa
          <input data-testid="settings-generic-key" value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} />
        </label>
        <label>
          Giá trị
          <input data-testid="settings-generic-value" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} />
        </label>
        <label>
          Mô tả
          <textarea data-testid="settings-generic-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </label>
        <button className="primary-button" data-testid="settings-generic-save" type="submit" disabled={saving === "generic"}>
          {saving === "generic" && <Loader2 className="spin" size={16} />}
          Lưu cấu hình
        </button>
      </form>

      <form className="panel form-stack" onSubmit={saveTaskConfig}>
        <div className="panel-head">
          <h2>Cấu hình công việc</h2>
        </div>
        <label className="toggle-line">
          <input
            data-testid="settings-task-redo-reset"
            type="checkbox"
            checked={taskConfigForm.redoResetProgress}
            onChange={(event) => setTaskConfigForm({ redoResetProgress: event.target.checked })}
          />
          Đặt tiến độ về 0 khi yêu cầu làm lại
        </label>
        <button className="primary-button" data-testid="settings-task-config-save" type="submit" disabled={saving === "task-config"}>
          {saving === "task-config" && <Loader2 className="spin" size={16} />}
          Lưu cấu hình công việc
        </button>
      </form>

      <form className="panel form-stack" onSubmit={saveAutoCode}>
        <div className="panel-head">
          <h2>Mã tự động</h2>
        </div>
        <div className="form-grid compact-form">
          <label>
            Prefix công việc
            <input
              data-testid="settings-task-prefix"
              required
              pattern="[A-Za-z0-9_-]{2,12}"
              value={autoCodeForm.taskPrefix}
              onChange={(event) => setAutoCodeForm({ ...autoCodeForm, taskPrefix: event.target.value })}
            />
          </label>
          <label>
            Số chữ số task
            <input
              data-testid="settings-task-padding"
              type="number"
              min="3"
              max="8"
              value={autoCodeForm.taskPadding}
              onChange={(event) => setAutoCodeForm({ ...autoCodeForm, taskPadding: event.target.value })}
            />
          </label>
          <label>
            Prefix hồ sơ
            <input
              data-testid="settings-workflow-prefix"
              required
              pattern="[A-Za-z0-9_-]{2,12}"
              value={autoCodeForm.workflowPrefix}
              onChange={(event) => setAutoCodeForm({ ...autoCodeForm, workflowPrefix: event.target.value })}
            />
          </label>
          <label>
            Số chữ số hồ sơ
            <input
              data-testid="settings-workflow-padding"
              type="number"
              min="3"
              max="8"
              value={autoCodeForm.workflowPadding}
              onChange={(event) => setAutoCodeForm({ ...autoCodeForm, workflowPadding: event.target.value })}
            />
          </label>
        </div>
        <button className="primary-button" data-testid="settings-auto-code-save" type="submit" disabled={saving === "auto-code"}>
          {saving === "auto-code" && <Loader2 className="spin" size={16} />}
          Lưu mã tự động
        </button>
      </form>

      <form className="panel form-stack" data-testid="settings-workflow-config-form" onSubmit={saveWorkflowConfig}>
        <div className="panel-head">
          <h2>Cấu hình quy trình</h2>
        </div>
        <label className="toggle-line">
          <input
            data-testid="settings-workflow-auto-activate"
            type="checkbox"
            checked={workflowConfigForm.autoActivateTemplate}
            onChange={(event) => setWorkflowConfigForm({ ...workflowConfigForm, autoActivateTemplate: event.target.checked })}
          />
          Tự động kích hoạt mẫu sau khi tạo
        </label>
        <div className="form-grid compact-form">
          <label>
            SLA bước mặc định
            <input
              data-testid="settings-workflow-default-deadline-amount"
              type="number"
              min="0"
              value={workflowConfigForm.defaultDeadlineAmount}
              onChange={(event) => setWorkflowConfigForm({ ...workflowConfigForm, defaultDeadlineAmount: event.target.value })}
            />
          </label>
          <label>
            Đơn vị SLA
            <select
              data-testid="settings-workflow-default-deadline-unit"
              value={workflowConfigForm.defaultDeadlineUnit}
              onChange={(event) => setWorkflowConfigForm({ ...workflowConfigForm, defaultDeadlineUnit: event.target.value })}
            >
              <option value="HOUR">Giờ</option>
              <option value="DAY">Ngày</option>
            </select>
          </label>
          <label>
            Nhắc trước hạn (giờ)
            <input
              data-testid="settings-workflow-default-reminder-hours"
              type="number"
              min="0"
              value={workflowConfigForm.defaultReminderBeforeHours}
              onChange={(event) => setWorkflowConfigForm({ ...workflowConfigForm, defaultReminderBeforeHours: event.target.value })}
            />
          </label>
          <label>
            Kiểu duyệt mặc định
            <select
              data-testid="settings-workflow-default-approval-mode"
              value={workflowConfigForm.defaultApprovalMode}
              onChange={(event) => setWorkflowConfigForm({ ...workflowConfigForm, defaultApprovalMode: event.target.value })}
            >
              <option value="SEQUENTIAL">Tuần tự</option>
              <option value="PARALLEL">Đồng thời</option>
            </select>
          </label>
          <label>
            Rule hoàn thành
            <select
              data-testid="settings-workflow-default-completion-rule"
              value={workflowConfigForm.defaultCompletionRule}
              onChange={(event) => setWorkflowConfigForm({ ...workflowConfigForm, defaultCompletionRule: event.target.value })}
            >
              <option value="ALL">Tất cả</option>
              <option value="ANY">Một người</option>
              <option value="MIN_COUNT">Tối thiểu số lượng</option>
              <option value="MIN_PERCENT">Tối thiểu tỷ lệ</option>
            </select>
          </label>
        </div>
        <button className="primary-button" data-testid="settings-workflow-config-save" type="submit" disabled={saving === "workflow-config"}>
          {saving === "workflow-config" && <Loader2 className="spin" size={16} />}
          Lưu cấu hình quy trình
        </button>
      </form>

      <form className="panel form-stack" onSubmit={saveFileConfig}>
        <div className="panel-head">
          <h2>Tệp upload</h2>
        </div>
        <label>
          Dung lượng tối đa (MB)
          <input
            data-testid="settings-file-max-mb"
            type="number"
            min="1"
            value={fileConfigForm.maxMb}
            onChange={(event) => setFileConfigForm({ ...fileConfigForm, maxMb: event.target.value })}
          />
        </label>
        <label>
          MIME type được phép
          <textarea
            data-testid="settings-file-mime-types"
            rows={8}
            value={fileConfigForm.mimeTypes}
            onChange={(event) => setFileConfigForm({ ...fileConfigForm, mimeTypes: event.target.value })}
          />
        </label>
        <button className="primary-button" data-testid="settings-file-config-save" type="submit" disabled={saving === "file-config"}>
          {saving === "file-config" && <Loader2 className="spin" size={16} />}
          Lưu cấu hình tệp
        </button>
      </form>

      <form className="panel wide form-stack" data-testid="settings-ops-form" onSubmit={saveOpsConfig}>
        <div className="panel-head">
          <h2>Thông báo, email, bảo mật và backup</h2>
        </div>
        <fieldset>
          <legend>Thông báo</legend>
          <div className="form-grid compact-form">
            <label className="toggle-line">
              <input
                data-testid="settings-notification-in-app"
                type="checkbox"
                checked={opsConfigForm.inAppNotifications}
                onChange={(event) => setOpsConfigForm({ ...opsConfigForm, inAppNotifications: event.target.checked })}
              />
              Bật thông báo trong ứng dụng
            </label>
            <label className="toggle-line">
              <input
                data-testid="settings-notification-push"
                type="checkbox"
                checked={opsConfigForm.pushNotifications}
                onChange={(event) => setOpsConfigForm({ ...opsConfigForm, pushNotifications: event.target.checked })}
              />
              Cho phép push mobile/desktop
            </label>
            <label className="toggle-line">
              <input
                data-testid="settings-notification-email"
                type="checkbox"
                checked={opsConfigForm.emailNotifications}
                onChange={(event) => setOpsConfigForm({ ...opsConfigForm, emailNotifications: event.target.checked })}
              />
              Cho phép gửi email
            </label>
            <label>
              Số giờ nhắc trước hạn
              <input
                data-testid="settings-deadline-reminder-hours"
                type="number"
                min="1"
                value={opsConfigForm.deadlineReminderHours}
                onChange={(event) => setOpsConfigForm({ ...opsConfigForm, deadlineReminderHours: event.target.value })}
              />
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Email SMTP</legend>
          <div className="form-grid compact-form">
            <label>
              SMTP host
              <input
                data-testid="settings-email-smtp-host"
                value={opsConfigForm.smtpHost}
                onChange={(event) => setOpsConfigForm({ ...opsConfigForm, smtpHost: event.target.value })}
              />
            </label>
            <label>
              SMTP port
              <input
                data-testid="settings-email-smtp-port"
                type="number"
                min="1"
                value={opsConfigForm.smtpPort}
                onChange={(event) => setOpsConfigForm({ ...opsConfigForm, smtpPort: event.target.value })}
              />
            </label>
            <label>
              Email gửi mặc định
              <input
                data-testid="settings-email-from-address"
                type="email"
                value={opsConfigForm.smtpFrom}
                onChange={(event) => setOpsConfigForm({ ...opsConfigForm, smtpFrom: event.target.value })}
              />
            </label>
            <label className="toggle-line">
              <input
                data-testid="settings-email-smtp-tls"
                type="checkbox"
                checked={opsConfigForm.smtpTls}
                onChange={(event) => setOpsConfigForm({ ...opsConfigForm, smtpTls: event.target.checked })}
              />
              Dùng TLS
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Bảo mật đăng nhập</legend>
          <div className="form-grid compact-form">
            <label>
              Số lần sai tối đa
              <input
                data-testid="settings-security-max-failed"
                type="number"
                min="1"
                value={opsConfigForm.maxFailedLogins}
                onChange={(event) => setOpsConfigForm({ ...opsConfigForm, maxFailedLogins: event.target.value })}
              />
            </label>
            <label>
              Số phút khóa/trì hoãn
              <input
                data-testid="settings-security-lock-minutes"
                type="number"
                min="1"
                value={opsConfigForm.lockMinutes}
                onChange={(event) => setOpsConfigForm({ ...opsConfigForm, lockMinutes: event.target.value })}
              />
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Backup</legend>
          <div className="form-grid compact-form">
            <label>
              Lịch backup database
              <input
                data-testid="settings-backup-schedule"
                value={opsConfigForm.backupSchedule}
                onChange={(event) => setOpsConfigForm({ ...opsConfigForm, backupSchedule: event.target.value })}
              />
            </label>
            <label>
              Số ngày giữ backup
              <input
                data-testid="settings-backup-retention-days"
                type="number"
                min="1"
                value={opsConfigForm.backupRetentionDays}
                onChange={(event) => setOpsConfigForm({ ...opsConfigForm, backupRetentionDays: event.target.value })}
              />
            </label>
            <label className="toggle-line">
              <input
                data-testid="settings-backup-uploads"
                type="checkbox"
                checked={opsConfigForm.backupUploads}
                onChange={(event) => setOpsConfigForm({ ...opsConfigForm, backupUploads: event.target.checked })}
              />
              Backup thư mục upload
            </label>
          </div>
        </fieldset>
        <button className="primary-button" data-testid="settings-ops-config-save" type="submit" disabled={saving === "ops-config"}>
          {saving === "ops-config" && <Loader2 className="spin" size={16} />}
          Lưu cấu hình vận hành
        </button>
      </form>

      {(settingMessage || settingError) && (
        <section className="panel wide compact-status" role={settingError ? "alert" : "status"} data-testid="settings-message">
          {settingError || settingMessage}
        </section>
      )}

      <section className="panel wide">
        <DataTable
          columns={["Khóa", "Giá trị", "Mô tả"]}
          rows={(data ?? []).map((setting) => ({
            key: setting.id,
            cells: [setting.key, JSON.stringify(setting.value), setting.description]
          }))}
        />
      </section>
    </section>
  );
}
