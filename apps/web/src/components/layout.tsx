import { Bell, LogOut, Menu, Moon, Smartphone, Sun } from "lucide-react";
import { useState } from "react";
import { ApiUser } from "../api/client";
import { cls } from "../lib/format";
import { mobileNav, navItems, Page } from "../navigation";

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

  function goToPage(nextPage: Page) {
    setPage(nextPage);
    setMobileMenuOpen(false);
  }

  return (
    <div className={cls("app-shell", dark && "dark")}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">WF</div>
          <div>
            <strong>WorkFlow</strong>
            <span>Management System</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.page}
                className={cls("nav-item", page === item.page && "active")}
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
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <Menu size={18} />
            </button>
            <span>{activeItem?.label ?? "Dashboard"}</span>
          </div>
          <div className="top-actions">
            <span className={cls("sync-pill", online ? "online" : "offline")}>
              <Smartphone size={14} />
              {online ? "Đang kết nối" : "Mất kết nối"}
            </span>
            <button className="icon-button" type="button" title="Đổi giao diện" onClick={() => setDark(!dark)}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="icon-button" type="button" title="Thông báo" onClick={() => setPage("dashboard")}>
              <Bell size={18} />
              {unread > 0 && <b>{unread}</b>}
            </button>
            <div className="account-menu">
              <span>{user.fullName}</span>
              <button className="icon-button" type="button" title="Đăng xuất" onClick={onLogout}>
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {mobileMenuOpen && (
          <nav className="mobile-menu-panel">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.page}
                  className={cls(page === item.page && "active")}
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

        <main className="content">{children}</main>
      </div>

      <nav className="bottom-nav">
        {mobileNav.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.page}
              className={page === item.page ? "active" : ""}
              data-testid={`bottom-nav-${item.page}`}
              onClick={() => goToPage(item.page)}
              type="button"
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
