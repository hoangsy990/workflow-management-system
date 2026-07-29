export const statusLabels: Record<string, string> = {
  DRAFT: "Bản nháp",
  TODO: "Chưa thực hiện",
  IN_PROGRESS: "Đang thực hiện",
  PAUSED: "Tạm dừng",
  PENDING_REVIEW: "Chờ đánh giá",
  DONE: "Hoàn thành",
  CANCELLED: "Đã hủy",
  OVERDUE: "Quá hạn",
  SUBMITTED: "Đã gửi",
  NEEDS_INFO: "Chờ bổ sung",
  APPROVED: "Đã duyệt",
  REJECTED: "Bị từ chối",
  COMPLETED: "Hoàn thành",
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Ngừng hoạt động"
};

export function formatDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh"
  }).format(new Date(value));
}

export function cls(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}
