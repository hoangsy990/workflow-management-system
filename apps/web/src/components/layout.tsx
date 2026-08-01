import { Bell, LogOut, Menu, Moon, Smartphone, Sun, UserCircle } from "lucide-react";
import { useState } from "react";
import { api, ApiUser } from "../api/client";
import { cls, formatDate } from "../lib/format";
import { mobileNav, navItems, Page } from "../navigation";

type AuthSession = {
  id: string;
  deviceName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  expiresAt: string;
};

export function AppShell({
  user,
  page,
  setPage,
  children,
  onLogout,
  unread,
  dark,
  setDark,
  online
}: {
  user: ApiUser;
  page: Page;
  setPage: (page: Page) => void;
  children: React.ReactNode;
  onLogout: () => void;
  unread: number;
  dark: boolean;
  setDark: (value: boolean) => void;
  online: boolean;
}) {
  const activeItem = navItems.find((item) => item.page === page);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState("");
  const [revokingSessionId, setRevokingSessionId] = useState("");
  const [confirmingLogoutAll, setConfirmingLogoutAll] = useState(false);
  const [revokingAll, setRevokingAll] = useState(false);

  function goToPage(nextPage: Page) {
    setPage(nextPage);
    setMobileMenuOpen(false);
    setSessionsOpen(false);
    setConfirmingLogoutAll(false);
  }

  async function loadSessions() {
    setSessionsLoading(true);
    setSessionsError("");
    try {
      setSessions((await api.authSessions()) as AuthSession[]);
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : "Không tải được phiên đăng nhập.");
    } finally {
      setSessionsLoading(false);
    }
  }

  function toggleSessions() {
    const nextOpen = !sessionsOpen;
    setSessionsOpen(nextOpen);
    setConfirmingLogoutAll(false);
    if (nextOpen) void loadSessions();
  }

  async function revokeSession(id: string) {
    setRevokingSessionId(id);
    setSessionsError("");
    try {
      await api.revokeAuthSession(id);
      setSessions((current) => current.filter((session) => session.id !== id));
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : "Không thu hồi được phiên đăng nhập.");
    } finally {
      setRevokingSessionId("");
    }
  }

  async function logoutAllSessions() {
    setRevokingAll(true);
    setSessionsError("");
    try {
      await api.logoutAllSessions();
      setSessions([]);
      onLogout();
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : "Không đăng xuất được tất cả thiết bị.");
      setRevokingAll(false);
    }
  }

  return (
    <div className={cls("app-shell", dark && "dark")}>
      <a className="skip-link" href="#main-content">
        Bỏ qua điều hướng
      </a>
      <aside className="sidebar" aria-label="Thanh điều hướng chính">
        <div className="brand">
          <div className="brand-mark">WF</div>
          <div>
            <strong>WorkFlow</strong>
            <span>Management System</span>
          </div>
        </div>
        <nav aria-label="Điều hướng chính">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.page}
                className={cls("nav-item", page === item.page && "active")}
                aria-current={page === item.page ? "page" : undefined}
                data-testid={`nav-${item.page}`}
                onClick={() => goToPage(item.page)}
                type="button"
                title={item.label}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="menu-trigger"
              type="button"
              title="Mở menu"
              aria-controls="mobile-menu-panel"
              aria-expanded={mobileMenuOpen}
              aria-label="Mở menu điều hướng"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <Menu size={18} />
            </button>
            <span id="page-title">{activeItem?.label ?? "Dashboard"}</span>
          </div>
          <div className="top-actions">
            <span className={cls("sync-pill", online ? "online" : "offline")} role="status" aria-live="polite">
              <Smartphone size={14} />
              {online ? "Đang kết nối" : "Mất kết nối"}
            </span>
            <button
              className="icon-button"
              type="button"
              title="Đổi giao diện"
              aria-label={dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
              aria-pressed={dark}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="icon-button"
              type="button"
              title="Thông báo"
              aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}
              onClick={() => goToPage("notifications")}
            >
              <Bell size={18} />
              {unread > 0 && <b aria-hidden="true">{unread}</b>}
            </button>
            <div className="account-menu" aria-label="Tài khoản">
              <span>{user.fullName}</span>
              <button
                className="icon-button"
                data-testid="account-profile-open"
                type="button"
                title="Hồ sơ"
                aria-label="Mở hồ sơ cá nhân"
                onClick={() => goToPage("profile")}
              >
                <UserCircle size={18} />
              </button>
              <button
                className="icon-button"
                data-testid="account-sessions-open"
                type="button"
                title="Phiên đăng nhập"
                aria-expanded={sessionsOpen}
                aria-label="Mở danh sách phiên đăng nhập"
                onClick={toggleSessions}
              >
                <Smartphone size={18} />
              </button>
              <button className="icon-button" type="button" title="Đăng xuất" aria-label="Đăng xuất" onClick={onLogout}>
                <LogOut size={18} />
              </button>
              {sessionsOpen && (
                <div className="session-popover" data-testid="auth-session-panel" role="dialog" aria-modal="false" aria-labelledby="session-panel-title">
                  <div className="session-popover-head">
                    <strong id="session-panel-title">Phiên đăng nhập</strong>
                    <button className="ghost-button compact" type="button" disabled={sessionsLoading} onClick={loadSessions}>
                      Làm mới
                    </button>
                  </div>
                  {sessionsError && (
                    <p className="form-error" role="alert">
                      {sessionsError}
                    </p>
                  )}
                  <div className="session-danger-zone">
                    {!confirmingLogoutAll ? (
                      <button
                        className="danger-button compact"
                        data-testid="auth-session-logout-all"
                        type="button"
                        disabled={sessionsLoading || revokingAll}
                        onClick={() => setConfirmingLogoutAll(true)}
                      >
                        Đăng xuất tất cả thiết bị
                      </button>
                    ) : (
                      <div className="session-confirm">
                        <span>Thu hồi toàn bộ phiên đăng nhập của tài khoản này?</span>
                        <div className="inline-actions">
                          <button
                            className="danger-button compact"
                            data-testid="auth-session-logout-all-confirm"
                            type="button"
                            disabled={revokingAll}
                            onClick={logoutAllSessions}
                          >
                            {revokingAll ? "Đang đăng xuất" : "Xác nhận đăng xuất"}
                          </button>
                          <button className="ghost-button compact" type="button" disabled={revokingAll} onClick={() => setConfirmingLogoutAll(false)}>
                            Hủy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {sessionsLoading ? (
                    <p role="status">Đang tải...</p>
                  ) : (
                    <div className="session-list" data-testid="auth-session-list">
                      {sessions.length === 0 && <p>Không có phiên đang hoạt động.</p>}
                      {sessions.map((session) => (
                        <div className="session-row" data-testid={`auth-session-row-${session.id}`} key={session.id}>
                          <div>
                            <strong>{session.deviceName || "Thiết bị không rõ"}</strong>
                            <span>
                              {session.ipAddress || "Không có IP"} · {formatDate(session.createdAt)}
                            </span>
                            {session.userAgent && <small>{session.userAgent}</small>}
                          </div>
                          <button className="danger-button compact" type="button" disabled={revokingSessionId === session.id} onClick={() => revokeSession(session.id)}>
                            {revokingSessionId === session.id ? "Đang thu hồi" : "Thu hồi"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {mobileMenuOpen && (
          <nav className="mobile-menu-panel" id="mobile-menu-panel" aria-label="Menu điều hướng di động">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.page}
                  className={cls(page === item.page && "active")}
                  aria-current={page === item.page ? "page" : undefined}
                  data-testid={`mobile-menu-${item.page}`}
                  type="button"
                  onClick={() => goToPage(item.page)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        <main className="content" id="main-content" aria-labelledby="page-title" tabIndex={-1}>
          {children}
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Điều hướng dưới trên điện thoại">
        {mobileNav.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.page}
              className={cls(page === item.page && "active", item.mobilePrimary && "mobile-primary")}
              aria-current={page === item.page ? "page" : undefined}
              data-testid={`bottom-nav-${item.page}`}
              onClick={() => goToPage(item.page)}
              type="button"
            >
              <span className="bottom-nav-icon">
                <Icon size={item.mobilePrimary ? 22 : 20} />
                {item.page === "notifications" && unread > 0 && <b aria-hidden="true">{unread}</b>}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
