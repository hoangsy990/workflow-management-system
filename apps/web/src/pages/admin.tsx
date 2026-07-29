import { Loader2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { DataTable, ErrorBlock, LoadingBlock, MultiCheck } from "../components/common";
import { useAsyncData } from "../hooks/useAsyncData";

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

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh"
  }).format(new Date(value));
}

function cls(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function UsersPage() {
  const { data, loading, error, reload } = useAsyncData(() => api.users(), []);
  const departments = useAsyncData(() => api.departments(), []);
  const roles = useAsyncData(() => api.roles(), []);
  const [form, setForm] = useState<Record<string, any>>({
    employeeCode: "",
    fullName: "",
    email: "",
    password: "Demo@123456",
    departmentId: "",
    roleIds: []
  });
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    await api.createUser({ ...form, departmentId: form.departmentId || undefined });
    setSaving(false);
    setForm({ employeeCode: "", fullName: "", email: "", password: "Demo@123456", departmentId: "", roleIds: [] });
    await reload();
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;

  return (
    <section className="page-grid">
      <form className="panel form-stack" onSubmit={submit}>
        <div className="panel-head">
          <h2>Tạo người dùng</h2>
        </div>
        <input placeholder="Mã nhân viên" value={form.employeeCode} onChange={(event) => setForm({ ...form, employeeCode: event.target.value })} required />
        <input placeholder="Họ tên" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
        <input placeholder="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        <input placeholder="Mật khẩu" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
        <select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}>
          <option value="">Phòng ban</option>
          {(departments.data ?? []).map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <MultiCheck
          label="Vai trò"
          items={roles.data ?? []}
          value={form.roleIds}
          onChange={(value) => setForm({ ...form, roleIds: value })}
        />
        <button className="primary-button" type="submit" disabled={saving}>
          Lưu người dùng
        </button>
      </form>
      <section className="panel wide">
        <div className="panel-head">
          <h2>Danh sách người dùng</h2>
        </div>
        <DataTable
          columns={["Mã", "Họ tên", "Email", "Phòng ban", "Vai trò", "Trạng thái"]}
          rows={(data?.data ?? []).map((user) => ({
            key: user.id,
            cells: [
              user.employeeCode,
              user.fullName,
              user.email,
              user.department?.name,
              user.roles?.map((item: Record<string, any>) => item.role.name).join(", "),
              user.status
            ]
          }))}
        />
      </section>
    </section>
  );
}

export function DepartmentsPage() {
  const { data, loading, error, reload } = useAsyncData(() => api.departments(), []);
  const users = useAsyncData(() => api.users(), []);
  const [form, setForm] = useState({ code: "", name: "", managerId: "" });
  async function submit(event: FormEvent) {
    event.preventDefault();
    await api.saveDepartment({ ...form, managerId: form.managerId || undefined });
    setForm({ code: "", name: "", managerId: "" });
    await reload();
  }
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  return (
    <section className="page-grid">
      <form className="panel form-stack" onSubmit={submit}>
        <div className="panel-head">
          <h2>Tạo phòng ban</h2>
        </div>
        <input placeholder="Mã phòng ban" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required />
        <input placeholder="Tên phòng ban" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <select value={form.managerId} onChange={(event) => setForm({ ...form, managerId: event.target.value })}>
          <option value="">Quản lý</option>
          {(users.data?.data ?? []).map((user) => (
            <option key={user.id} value={user.id}>
              {user.fullName}
            </option>
          ))}
        </select>
        <button className="primary-button" type="submit">
          Lưu phòng ban
        </button>
      </form>
      <section className="panel wide">
        <div className="panel-head">
          <h2>Cơ cấu tổ chức</h2>
        </div>
        <DataTable
          columns={["Mã", "Tên", "Quản lý", "Nhân sự", "Công việc"]}
          rows={(data ?? []).map((department) => ({
            key: department.id,
            cells: [department.code, department.name, department.manager?.fullName, department._count?.users, department._count?.tasks]
          }))}
        />
      </section>
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

export function SettingsPage() {
  const { data, loading, error, reload } = useAsyncData(() => api.settings(), []);
  const [form, setForm] = useState({ key: "task.redo.reset_progress", value: "false", description: "" });
  async function submit(event: FormEvent) {
    event.preventDefault();
    await api.saveSetting({ key: form.key, value: form.value === "true" ? true : form.value, description: form.description });
    await reload();
  }
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  return (
    <section className="page-grid">
      <form className="panel form-stack" onSubmit={submit}>
        <div className="panel-head">
          <h2>Cấu hình hệ thống</h2>
        </div>
        <input value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} />
        <input value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} />
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <button className="primary-button" type="submit">
          Lưu cấu hình
        </button>
      </form>
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
