import { describe, expect, it } from "vitest";
import { makePdf } from "./pdf.js";

describe("report PDF export", () => {
  it("creates a basic PDF buffer with escaped text and EOF marker", () => {
    const pdf = makePdf([
      ["Loai", "Ma", "Noi dung"],
      ["Cong viec", "TASK-1", "Bao cao (can kiem tra) \\ file"]
    ]);

    const text = pdf.toString("utf8");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("Bao cao \\(can kiem tra\\) \\\\ file");
    expect(text).toContain("%%EOF");
  });
});
