import { describe, expect, it } from "vitest";
import {
  assertWorkflowVersionEditable,
  evaluateConditions,
  isStepComplete
} from "./workflow.domain.js";

describe("workflow domain", () => {
  it("rẽ nhánh theo điều kiện có cấu trúc", () => {
    const result = evaluateConditions(
      [
        { fieldCode: "amount", operator: "gt", compareValue: 50000000 },
        { fieldCode: "type", operator: "eq", compareValue: "asset" }
      ],
      { amount: 72000000, type: "asset" }
    );
    expect(result).toBe(true);
  });

  it("hỗ trợ phê duyệt đồng thời theo số lượng tối thiểu", () => {
    expect(
      isStepComplete({
        mode: "PARALLEL",
        rule: "MIN_COUNT",
        totalApprovers: 4,
        approvedCount: 2,
        minCount: 2
      })
    ).toBe(true);
  });

  it("hỗ trợ phê duyệt đồng thời theo tỷ lệ tối thiểu", () => {
    expect(
      isStepComplete({
        mode: "PARALLEL",
        rule: "MIN_PERCENT",
        totalApprovers: 5,
        approvedCount: 3,
        minPercent: 60
      })
    ).toBe(true);
  });

  it("không cho sửa phiên bản quy trình đã phát sinh hồ sơ", () => {
    expect(() => assertWorkflowVersionEditable({ status: "ACTIVE", instanceCount: 1 })).toThrow(
      "không được sửa trực tiếp"
    );
  });
});

