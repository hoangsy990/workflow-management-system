import { describe, expect, it } from "vitest";
import { buildCatalogItemImportPreview, parseCatalogItemImportCsv } from "./catalog-import.js";

const references = {
  existingCodes: new Set<string>(),
  departmentCodes: new Set(["hr", "it"]),
  managerEmployeeCodes: new Set(["mgr001"])
};

describe("catalog item import", () => {
  it("parses quoted catalog item CSV rows", () => {
    const rows = parseCatalogItemImportCsv('code,name,status,departmentCode,managerEmployeeCode\nREQ,"Mua, hang",ACTIVE,HR,MGR001');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      code: "REQ",
      name: "Mua, hang",
      statusText: "ACTIVE",
      departmentCode: "HR",
      managerEmployeeCode: "MGR001"
    });
  });

  it("returns row errors for duplicates and missing references", () => {
    const rows = parseCatalogItemImportCsv(
      ["code,name,status,departmentCode,managerEmployeeCode", "REQ,Mua hang,ACTIVE,HR,MGR001", "REQ,,BAD,NOPE,MISSING"].join("\n")
    );
    const preview = buildCatalogItemImportPreview(rows, references);

    expect(preview.canApply).toBe(false);
    expect(preview.summary).toEqual({ total: 2, valid: 1, invalid: 1 });
    expect(preview.rows[1]!.errors).toEqual(
      expect.arrayContaining([
        "Thiếu tên hiển thị.",
        "Mã giá trị bị trùng trong file.",
        "Trạng thái không hợp lệ.",
        "Không tìm thấy phòng ban NOPE.",
        "Không tìm thấy quản lý MISSING."
      ])
    );
  });
});
