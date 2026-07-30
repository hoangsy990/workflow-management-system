import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, apiAssetUrl } from "../api/client";
import { ErrorBlock, LoadingBlock } from "../components/common";
import { useAsyncData } from "../hooks/useAsyncData";
import { formatDate, statusLabels } from "../lib/format";

function profileForm(data?: Record<string, any> | null) {
  return {
    fullName: data?.fullName ?? "",
    phone: data?.phone ?? "",
    title: data?.title ?? "",
    avatarUrl: data?.avatarUrl ?? ""
  };
}

const emptyPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
};

function names(items: Array<Record<string, any>> | undefined, key: "role" | "team") {
  const values = (items ?? []).map((item) => item[key]?.name).filter(Boolean);
  if (values.length === 0) return "Chưa có";
  const visible = values.slice(0, 5).join(", ");
  return values.length > 5 ? `${visible} +${values.length - 5}` : visible;
}

export function ProfilePage({
  onProfileUpdated,
  onPasswordChanged
}: {
  onProfileUpdated?: (profile: Record<string, any>) => void;
  onPasswordChanged?: () => void;
}) {
  const { data, loading, error, reload } = useAsyncData(() => api.profile(), []);
  const activity = useAsyncData(() => api.profileActivity(), []);
  const [form, setForm] = useState(profileForm(null));
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [saved, setSaved] = useState(false);
  const [avatarSaved, setAvatarSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setForm(profileForm(data));
      setSaveError("");
    }
  }, [data]);

  const summary = useMemo(
    () => [
      { label: "Mã nhân viên", value: data?.employeeCode },
      { label: "Email", value: data?.email },
      { label: "Chức danh", value: data?.title ?? "Chưa có" },
      { label: "Trạng thái", value: statusLabels[data?.status] ?? data?.status },
      { label: "Phòng ban", value: data?.department?.name ?? "Chưa có" },
      { label: "Quản lý trực tiếp", value: data?.manager?.fullName ?? "Chưa có" },
      { label: "Nhóm làm việc", value: names(data?.teams, "team") },
      { label: "Vai trò", value: names(data?.roles, "role") },
      { label: "Ngày tạo", value: data?.createdAt ? formatDate(data.createdAt) : "Chưa có" },
      { label: "Lần đăng nhập gần nhất", value: data?.lastLoginAt ? formatDate(data.lastLoginAt) : "Chưa có" }
    ],
    [data]
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      const profile = await api.updateProfile({
        fullName: form.fullName,
        phone: form.phone || null,
        title: form.title || null,
        avatarUrl: form.avatarUrl || null
      });
      onProfileUpdated?.(profile);
      setSaved(true);
      await reload();
      await activity.reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Không cập nhật được hồ sơ.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar() {
    if (!avatarFile || avatarUploading) return;
    setAvatarError("");
    setAvatarSaved(false);
    if (!["image/jpeg", "image/png", "image/webp"].includes(avatarFile.type)) {
      setAvatarError("Ảnh đại diện chỉ hỗ trợ JPG, PNG hoặc WebP.");
      return;
    }
    if (avatarFile.size > 5 * 1024 * 1024) {
      setAvatarError("Ảnh đại diện không được vượt quá 5MB.");
      return;
    }
    setAvatarUploading(true);
    try {
      const result = await api.uploadProfileAvatar(avatarFile);
      setForm((current) => ({ ...current, avatarUrl: result.avatarUrl ?? "" }));
      setAvatarFile(null);
      setAvatarSaved(true);
      onProfileUpdated?.(result);
      await reload();
      await activity.reload();
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Không tải được ảnh đại diện.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    if (changingPassword) return;
    setPasswordError("");
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setChangingPassword(true);
    try {
      await api.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordForm(emptyPasswordForm);
      onPasswordChanged?.();
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Không đổi được mật khẩu.");
      setChangingPassword(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;

  return (
    <section className="detail-grid">
      <form className="panel form-grid" data-testid="profile-form" onSubmit={submit}>
        <div className="panel-head">
          <div>
            <h2>Hồ sơ cá nhân</h2>
            <p>{data?.email}</p>
          </div>
        </div>
        <label>
          Họ tên
          <input data-testid="profile-full-name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
        </label>
        <label>
          Số điện thoại
          <input data-testid="profile-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        </label>
        <label>
          Chức danh
          <input data-testid="profile-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </label>
        <label>
          URL ảnh đại diện
          <input data-testid="profile-avatar-url" value={form.avatarUrl} onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })} />
        </label>
        <div className="avatar-upload">
          {form.avatarUrl ? (
            <img alt="Ảnh đại diện" data-testid="profile-avatar-preview" src={apiAssetUrl(form.avatarUrl)} />
          ) : (
            <div className="avatar-placeholder" data-testid="profile-avatar-placeholder">Avatar</div>
          )}
          <label>
            Chọn ảnh đại diện
            <input
              accept="image/jpeg,image/png,image/webp"
              data-testid="profile-avatar-file"
              type="file"
              onChange={(event) => {
                setAvatarSaved(false);
                setAvatarError("");
                setAvatarFile(event.target.files?.[0] ?? null);
              }}
            />
          </label>
          <button className="ghost-button" data-testid="profile-avatar-upload" type="button" disabled={!avatarFile || avatarUploading} onClick={uploadAvatar}>
            {avatarUploading ? "Đang tải..." : "Tải ảnh lên"}
          </button>
        </div>
        {avatarError && <p className="form-error" data-testid="profile-avatar-error">{avatarError}</p>}
        {avatarSaved && <p className="success-text" data-testid="profile-avatar-success">Đã cập nhật ảnh đại diện.</p>}
        {saveError && <p className="form-error">{saveError}</p>}
        {saved && <p className="success-text" data-testid="profile-save-success">Đã cập nhật hồ sơ.</p>}
        <button className="primary-button" data-testid="profile-save" type="submit" disabled={saving}>
          {saving ? "Đang lưu..." : "Lưu hồ sơ"}
        </button>
      </form>

      <section className="panel">
        <div className="panel-head">
          <h2>Thông tin tài khoản</h2>
        </div>
        <div className="profile-summary" data-testid="profile-summary">
          {summary.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value || "Chưa có"}</strong>
            </div>
          ))}
        </div>
      </section>

      <form className="panel wide form-grid" data-testid="profile-password-form" onSubmit={submitPassword}>
        <div className="panel-head">
          <div>
            <h2>Đổi mật khẩu</h2>
            <p>Các phiên đăng nhập sẽ được thu hồi sau khi đổi mật khẩu.</p>
          </div>
        </div>
        <label>
          Mật khẩu hiện tại
          <input
            autoComplete="current-password"
            data-testid="profile-current-password"
            type="password"
            value={passwordForm.currentPassword}
            onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
            required
          />
        </label>
        <label>
          Mật khẩu mới
          <input
            autoComplete="new-password"
            data-testid="profile-new-password"
            minLength={8}
            type="password"
            value={passwordForm.newPassword}
            onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
            required
          />
        </label>
        <label>
          Xác nhận mật khẩu mới
          <input
            autoComplete="new-password"
            data-testid="profile-confirm-password"
            minLength={8}
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
            required
          />
        </label>
        {passwordError && <p className="form-error" data-testid="profile-password-error">{passwordError}</p>}
        <button className="danger-button" data-testid="profile-password-save" type="submit" disabled={changingPassword}>
          {changingPassword ? "Đang đổi..." : "Đổi mật khẩu"}
        </button>
      </form>

      <section className="panel wide">
        <div className="panel-head">
          <div>
            <h2>Hoạt động gần đây</h2>
            <p>Nhật ký thao tác của tài khoản hiện tại.</p>
          </div>
          <button className="ghost-button compact" type="button" disabled={activity.loading} onClick={() => void activity.reload()}>
            Làm mới
          </button>
        </div>
        {activity.error && <p className="form-error">{activity.error}</p>}
        {activity.loading ? (
          <p>Đang tải...</p>
        ) : (
          <div className="timeline" data-testid="profile-activity">
            {(activity.data?.data ?? []).length === 0 && <p>Chưa có hoạt động.</p>}
            {(activity.data?.data ?? []).map((item) => (
              <div key={item.id}>
                <strong>{item.action}</strong>
                <span>{item.entityType}</span>
                <small>{formatDate(item.createdAt)}</small>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
