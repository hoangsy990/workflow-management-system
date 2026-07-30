import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Columns3,
  FileClock,
  Home,
  Settings,
  ShieldCheck,
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
  | "workflowTemplates"
  | "workflowBuilder"
  | "workflowInstances"
  | "newInstance"
  | "instanceDetail"
  | "approvals"
  | "users"
  | "departments"
  | "roles"
  | "logs"
  | "settings"
  | "profile";

export interface NavItem {
  page: Page;
  label: string;
  icon: typeof Home;
}

export const navItems: NavItem[] = [
  { page: "dashboard", label: "Dashboard", icon: Home },
  { page: "myTasks", label: "Công việc của tôi", icon: ClipboardCheck },
  { page: "tasks", label: "Tất cả công việc", icon: FileClock },
  { page: "kanban", label: "Kanban", icon: Columns3 },
  { page: "calendar", label: "Lịch", icon: CalendarDays },
  { page: "workflowTemplates", label: "Mẫu quy trình", icon: Workflow },
  { page: "workflowInstances", label: "Hồ sơ quy trình", icon: FileClock },
  { page: "approvals", label: "Chờ tôi duyệt", icon: CheckCircle2 },
  { page: "users", label: "Người dùng", icon: Users },
  { page: "departments", label: "Phòng ban", icon: Activity },
  { page: "roles", label: "Vai trò", icon: ShieldCheck },
  { page: "logs", label: "Nhật ký", icon: Activity },
  { page: "settings", label: "Cấu hình", icon: Settings },
  { page: "profile", label: "Hồ sơ", icon: UserCircle }
];

export const mobileNav = navItems.slice(0, 5);
