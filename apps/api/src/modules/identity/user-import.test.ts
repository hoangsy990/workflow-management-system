import { describe, expect, it } from "vitest";
import { buildUserImportPreview, parseUserImportCsv } from "./user-import.js";

const emptyReferences = {
  existingEmployeeCodes: new Set<string>(),
  existingEmails: new Set<string>(),
  departmentCodes: new Set(["hr", "it"]),
  managerEmployeeCodes: new Set(["mgr001"]),
  roleCodes: new Set(["employee", "manager"]),
  teamCodes: new Set(["ops"])
};

describe("user import", () => {
  it("parses quoted CSV rows and semicolon code lists", () => {
    const rows = parseUserImportCsv(
      'employeeCode,fullName,email,departmentCode,roleCodes,teamCodes\nNV001,"Nguyen, An",an@example.com,HR,"employee;manager",ops'
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      employeeCode: "NV001",
      fullName: "Nguyen, An",
      email: "an@example.com",
      departmentCode: "HR",
      roleCodes: ["employee", "manager"],
      teamCodes: ["ops"]
    });
  });

  it("returns row-level validation errors for duplicates and missing references", () => {
    const rows = parseUserImportCsv(
      [
        "employeeCode,fullName,email,departmentCode,roleCodes",
        "NV001,Nguyen An,an@example.com,HR,employee",
        "NV001,Tran Binh,an@example.com,NOPE,missing_role"
      ].join("\n")
    );
    const preview = buildUserImportPreview(rows, emptyReferences);

    expect(preview.canApply).toBe(false);
    expect(preview.summary).toEqual({ total: 2, valid: 1, invalid: 1 });
    expect(preview.rows[1]!.errors).toEqual(
      expect.arrayContaining([
        "Mã nhân viên bị trùng trong file.",
        "Email bị trùng trong file.",
        "Không tìm thấy phòng ban NOPE.",
        "Không tìm thấy vai trò missing_role."
      ])
    );
  });

  it("accepts manager codes from the same import file", () => {
    const rows = parseUserImportCsv(
      [
        "employeeCode,fullName,email,managerEmployeeCode",
        "MGR002,Quan Ly,mgr002@example.com,",
        "NV002,Nhan Vien,nv002@example.com,MGR002"
      ].join("\n")
    );
    const preview = buildUserImportPreview(rows, emptyReferences);

    expect(preview.canApply).toBe(true);
    expect(preview.summary.invalid).toBe(0);
  });
});
