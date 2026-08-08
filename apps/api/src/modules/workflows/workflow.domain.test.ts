import { describe, expect, it } from "vitest";
import {
  applyWorkflowCalculatedValues,
  applyWorkflowDefaultValues,
  assertWorkflowVersionEditable,
  evaluateConditions,
  isStepComplete,
  validateWorkflowFormData
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

  it("validates workflow form data by configured fields", () => {
    const errors = validateWorkflowFormData(
      [
        { code: "purpose", name: "Purpose", type: "SHORT_TEXT", isRequired: true },
        { code: "amount", name: "Amount", type: "CURRENCY", isRequired: true },
        { code: "fromDate", name: "From date", type: "DATE", isRequired: true },
        { code: "confirmed", name: "Confirmed", type: "CHECKBOX", isRequired: false }
      ],
      { purpose: "", amount: "abc", fromDate: "not-a-date", confirmed: "yes" }
    );

    expect(errors).toHaveLength(4);
    expect(errors[0]).toContain("Purpose");
    expect(errors[1]).toContain("Amount");
    expect(errors[2]).toContain("From date");
    expect(errors[3]).toContain("Confirmed");
  });

  it("applies default values and validates structured rules", () => {
    const fields = [
      {
        code: "purpose",
        name: "Purpose",
        type: "SHORT_TEXT" as const,
        isRequired: true,
        defaultValue: "Payment proposal",
        validation: { minLength: 5, maxLength: 20 }
      },
      {
        code: "amount",
        name: "Amount",
        type: "CURRENCY" as const,
        isRequired: true,
        validation: { min: 1000, max: 5000 }
      }
    ];

    const withDefaults = applyWorkflowDefaultValues(fields, { amount: 900 });
    expect(withDefaults.purpose).toBe("Payment proposal");
    expect(validateWorkflowFormData(fields, withDefaults)).toEqual(["Trường 'Amount' phải lớn hơn hoặc bằng 1000."]);
    expect(validateWorkflowFormData(fields, { purpose: "abc", amount: 6000 })).toEqual([
      "Trường 'Purpose' cần tối thiểu 5 ký tự.",
      "Trường 'Amount' phải nhỏ hơn hoặc bằng 5000."
    ]);
  });

  it("validates select and radio values against configured options", () => {
    const errors = validateWorkflowFormData(
      [
        {
          code: "requestType",
          name: "Request type",
          type: "SELECT",
          isRequired: true,
          validation: { options: ["Payment", "Purchase"] }
        },
        {
          code: "confirmation",
          name: "Confirmation",
          type: "RADIO",
          isRequired: true,
          validation: { options: ["Yes", "No"] }
        }
      ],
      { requestType: "Other", confirmation: "Maybe" }
    );

    expect(errors).toEqual([
      "Trường 'Request type' phải thuộc danh sách lựa chọn.",
      "Trường 'Confirmation' phải thuộc danh sách lựa chọn."
    ]);
  });

  it("skips required validation for hidden fields and calculates numeric fields", () => {
    const fields = [
      {
        code: "requestType",
        name: "Request type",
        type: "SELECT" as const,
        isRequired: true,
        validation: { options: ["Normal", "Asset"] }
      },
      {
        code: "assetNote",
        name: "Asset note",
        type: "SHORT_TEXT" as const,
        isRequired: true,
        validation: { visibleWhen: { fieldCode: "requestType", operator: "eq", compareValue: "Asset" } }
      },
      {
        code: "subtotal",
        name: "Subtotal",
        type: "CURRENCY" as const,
        isRequired: true
      },
      {
        code: "tax",
        name: "Tax",
        type: "CURRENCY" as const,
        isRequired: true
      },
      {
        code: "total",
        name: "Total",
        type: "CURRENCY" as const,
        isRequired: true,
        validation: { calculation: { operator: "SUM", fieldCodes: ["subtotal", "tax"] } }
      }
    ];

    expect(validateWorkflowFormData(fields, { requestType: "Normal", subtotal: 100, tax: 10 })).toEqual([]);
    expect(applyWorkflowCalculatedValues(fields, { subtotal: 100, tax: 10 }).total).toBe(110);
    const hiddenFieldErrors = validateWorkflowFormData(fields, { requestType: "Asset", subtotal: 100, tax: 10 });
    expect(hiddenFieldErrors).toHaveLength(1);
    expect(hiddenFieldErrors[0]).toContain("Asset note");
  });
});
