import { Edit3, Loader2, Plus, Save, Trash2, XCircle } from "lucide-react";
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

  const departments = useMemo(() => data ?? [], [data]);
  const usersList = useMemo(() => users.data?.data ?? [], [users.data]);
  const teamsList = useMemo(() => teamData.data ?? [], [teamData.data]);
  const departmentRows = useMemo(() => flattenDepartments(departments), [departments]);
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

export function CatalogsPage() {
  const categories = useAsyncData(() => api.taskCategories(), []);
  const tags = useAsyncData(() => api.tags(), []);
  const [categoryForm, setCategoryForm] = useState({ ...emptyCategoryForm });
  const [tagForm, setTagForm] = useState({ ...emptyTagForm });
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const [editingCategory, setEditingCategory] = useState({ ...emptyCategoryForm });
  const [editingTagId, setEditingTagId] = useState("");
  const [editingTag, setEditingTag] = useState({ ...emptyTagForm });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");

  const loading = categories.loading || tags.loading;
  const error = categories.error || tags.error;

  async function reloadCatalogs() {
    await Promise.all([categories.reload(), tags.reload()]);
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
  const [autoCodeForm, setAutoCodeForm] = useState({
    taskPrefix: "TASK",
    taskPadding: "4",
    workflowPrefix: "WF",
    workflowPadding: "4"
  });
  const [fileConfigForm, setFileConfigForm] = useState({
    maxMb: "20",
    mimeTypes: defaultFileUploadMimeTypes.join("\n")
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
    const rawMimeTypes = data.find((setting) => setting.key === "file.upload.allowed_mime_types")?.value;
    setFileConfigForm({
      maxMb: settingValue(data, "file.upload.max_mb", "20"),
      mimeTypes: Array.isArray(rawMimeTypes)
        ? rawMimeTypes.filter((item): item is string => typeof item === "string").join("\n")
        : typeof rawMimeTypes === "string"
          ? rawMimeTypes
          : defaultFileUploadMimeTypes.join("\n")
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
