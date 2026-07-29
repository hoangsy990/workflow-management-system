import type { ApprovalMode, StepCompletionRule, WorkflowVersionStatus } from "@prisma/client";

export type ConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "in"
  | "not_in"
  | "exists";

export interface StructuredCondition {
  fieldCode: string;
  operator: ConditionOperator | string;
  compareValue: unknown;
  groupType?: "AND" | "OR";
}

function normalizeComparable(value: unknown) {
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return value;
}

export function evaluateCondition(condition: StructuredCondition, values: Record<string, unknown>): boolean {
  const actual = normalizeComparable(values[condition.fieldCode]);
  const expected = normalizeComparable(condition.compareValue);

  switch (condition.operator) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "gt":
      return Number(actual) > Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
    case "contains":
      return Array.isArray(actual) ? actual.includes(expected) : String(actual ?? "").includes(String(expected ?? ""));
    case "in":
      return Array.isArray(expected) && expected.includes(actual);
    case "not_in":
      return Array.isArray(expected) && !expected.includes(actual);
    case "exists":
      return actual !== undefined && actual !== null && actual !== "";
    default:
      return false;
  }
}

export function evaluateConditions(conditions: StructuredCondition[], values: Record<string, unknown>): boolean {
  if (conditions.length === 0) {
    return true;
  }

  const orConditions = conditions.filter((condition) => condition.groupType === "OR");
  const andConditions = conditions.filter((condition) => condition.groupType !== "OR");
  const andResult = andConditions.every((condition) => evaluateCondition(condition, values));
  const orResult = orConditions.length === 0 || orConditions.some((condition) => evaluateCondition(condition, values));
  return andResult && orResult;
}

export function isStepComplete(input: {
  mode: ApprovalMode;
  rule: StepCompletionRule;
  totalApprovers: number;
  approvedCount: number;
  minCount?: number | null;
  minPercent?: number | null;
}): boolean {
  if (input.totalApprovers <= 0) {
    return true;
  }

  if (input.mode === "SEQUENTIAL") {
    return input.approvedCount >= input.totalApprovers;
  }

  if (input.rule === "ANY") {
    return input.approvedCount >= 1;
  }
  if (input.rule === "MIN_COUNT") {
    return input.approvedCount >= (input.minCount ?? input.totalApprovers);
  }
  if (input.rule === "MIN_PERCENT") {
    const percent = (input.approvedCount / input.totalApprovers) * 100;
    return percent >= (input.minPercent ?? 100);
  }
  return input.approvedCount >= input.totalApprovers;
}

export function assertWorkflowVersionEditable(input: { status: WorkflowVersionStatus; instanceCount: number }) {
  if (input.status !== "DRAFT" && input.instanceCount > 0) {
    throw new Error("Phiên bản quy trình đã phát sinh hồ sơ không được sửa trực tiếp.");
  }
}

