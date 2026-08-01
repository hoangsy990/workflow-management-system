import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Columns3,
  FileClock,
  Home,
  PlusCircle,
  Settings,
  ShieldCheck,
  Tags,
  UserCircle,
  Users,
  Workflow
} from "lucide-react";

export type Page =
  | "dashboard"
  | "myTasks"
  | "tasks"
  | "kanban"
  | "calendar"
  | "newTask"
  | "taskDetail"
  | "notifications"
  | "workflowTemplates"
  | "workflowBuilder"
  | "workflowInstances"
  | "newInstance"
  | "instanceDetail"
  | "approvals"
  | "reports"
  | "users"
  | "departments"
  | "catalogs"
  | "roles"
  | "logs"
  | "settings"
  | "profile";

export interface NavItem {
  page: Page;
  label: string;
  icon: typeof Home;
  mobilePrimary?: boolean;
}

export const navItems: NavItem[] = [
  { page: "dashboard", label: "Dashboard", icon: Home },
  { page: "myTasks", label: "Công việc của tôi", icon: ClipboardCheck },
  { page: "tasks", label: "Tất cả công việc", icon: FileClock },
  { page: "newTask", label: "Tạo công việc", icon: PlusCircle },
  { page: "kanban", label: "Kanban", icon: Columns3 },
  { page: "calendar", label: "Lịch", icon: CalendarDays },
  { page: "workflowTemplates", label: "Mẫu quy trình", icon: Workflow },
  { page: "workflowInstances", label: "Hồ sơ quy trình", icon: FileClock },
  { page: "approvals", label: "Chờ tôi duyệt", icon: CheckCircle2 },
  { page: "reports", label: "Báo cáo", icon: BarChart3 },
  { page: "notifications", label: "Thông báo", icon: Bell },
  { page: "users", label: "Người dùng", icon: Users },
  { page: "departments", label: "Phòng ban", icon: Activity },
  { page: "catalogs", label: "Danh mục", icon: Tags },
  { page: "roles", label: "Vai trò", icon: ShieldCheck },
  { page: "logs", label: "Nhật ký", icon: Activity },
  { page: "settings", label: "Cấu hình", icon: Settings },
  { page: "profile", label: "Hồ sơ", icon: UserCircle }
];

export const mobileNav: NavItem[] = [
  { page: "dashboard", label: "Tổng quan", icon: Home },
  { page: "myTasks", label: "Công việc", icon: ClipboardCheck },
  { page: "newTask", label: "Tạo", icon: PlusCircle, mobilePrimary: true },
  { page: "approvals", label: "Duyệt", icon: CheckCircle2 },
  { page: "notifications", label: "Thông báo", icon: Bell },
  { page: "profile", label: "Cá nhân", icon: UserCircle }
];
