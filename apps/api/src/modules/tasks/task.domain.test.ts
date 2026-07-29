import { describe, expect, it } from "vitest";
import { assertNoTaskCycle, isTaskOverdue, nextStatusAfterProgress } from "./task.domain.js";

describe("task domain", () => {
  it("chuyển sang chờ đánh giá khi tiến độ đạt 100% và cần đánh giá", () => {
    expect(nextStatusAfterProgress({ currentStatus: "IN_PROGRESS", progress: 100, requiresReview: true })).toBe(
      "PENDING_REVIEW"
    );
  });

  it("chuyển thẳng hoàn thành khi không cần đánh giá", () => {
    expect(nextStatusAfterProgress({ currentStatus: "IN_PROGRESS", progress: 100, requiresReview: false })).toBe(
      "DONE"
    );
  });

  it("tự phát hiện công việc quá hạn thay vì lưu trạng thái cứng", () => {
    expect(
      isTaskOverdue({
        status: "IN_PROGRESS",
        dueDate: new Date("2026-01-01T00:00:00.000Z"),
        now: new Date("2026-01-02T00:00:00.000Z")
      })
    ).toBe(true);
  });

  it("không coi công việc đã hoàn thành là quá hạn", () => {
    expect(
      isTaskOverdue({
        status: "DONE",
        dueDate: new Date("2026-01-01T00:00:00.000Z"),
        now: new Date("2026-01-02T00:00:00.000Z")
      })
    ).toBe(false);
  });

  it("không cho tạo quan hệ công việc cha/con vòng lặp", async () => {
    const parents = new Map([
      ["task-a", "task-b"],
      ["task-b", "task-c"],
      ["task-c", "task-a"]
    ]);

    await expect(assertNoTaskCycle("task-a", "task-b", async (id) => parents.get(id) ?? null)).rejects.toThrow(
      "vòng lặp"
    );
  });
});

