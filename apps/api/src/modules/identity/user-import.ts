const headerAliases: Record<string, string[]> = {
  employeeCode: ["employeeCode", "employee_code", "ma_nhan_vien", "ma nhan vien", "ma_nv", "code"],
  fullName: ["fullName", "full_name", "ho_ten", "ho ten", "name"],
  email: ["email", "mail"],
  phone: ["phone", "so_dien_thoai", "so dien thoai", "dien_thoai"],
  title: ["title", "chuc_danh", "chuc danh"],
  password: ["password", "mat_khau", "mat khau"],
  departmentCode: ["departmentCode", "department_code", "ma_phong_ban", "ma phong ban", "department"],
  managerEmployeeCode: ["managerEmployeeCode", "manager_employee_code", "ma_quan_ly", "ma quan ly", "manager"],
  roleCodes: ["roleCodes", "role_codes", "vai_tro", "vai tro", "roles"],
  teamCodes: ["teamCodes", "team_codes", "nhom", "team", "teams"]
};

export interface UserImportRecord {
  rowNumber: number;
  employeeCode: string;
  fullName: string;
  email: string;
  phone?: string;
  title?: string;
  password?: string;
  departmentCode?: string;
  managerEmployeeCode?: string;
  roleCodes: string[];
  teamCodes: string[];
}

export interface UserImportPreviewRow extends UserImportRecord {
  status: "VALID" | "ERROR";
  errors: string[];
}

export interface UserImportReferenceData {
  existingEmployeeCodes: Set<string>;
  existingEmails: Set<string>;
  departmentCodes: Set<string>;
  managerEmployeeCodes: Set<string>;
  roleCodes: Set<string>;
  teamCodes: Set<string>;
}

export interface UserImportPreview {
  rows: UserImportPreviewRow[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
  };
  canApply: boolean;
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function normalizeValue(value?: string) {
  return (value ?? "").trim();
}

function splitCodes(value?: string) {
  return normalizeValue(value)
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];
    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(cell);
      cell = "";
      continue;
    }
    cell += char;
  }
  result.push(cell);
  return result;
}

export function parseUserImportCsv(csv: string): UserImportRecord[] {
  const normalizedCsv = csv.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalizedCsv.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0] ?? "").map(normalizeHeader);
  const fieldIndexes = {} as Record<keyof typeof headerAliases, number>;
  for (const field of Object.keys(headerAliases) as Array<keyof typeof headerAliases>) {
    const normalizedAliases = (headerAliases[field] ?? []).map(normalizeHeader);
    fieldIndexes[field] = headers.findIndex((header) => normalizedAliases.includes(header));
  }

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const valueOf = (field: keyof typeof headerAliases) => {
      const columnIndex = fieldIndexes[field] ?? -1;
      return columnIndex >= 0 ? normalizeValue(values[columnIndex]) : "";
    };

    return {
      rowNumber: index + 2,
      employeeCode: valueOf("employeeCode"),
      fullName: valueOf("fullName"),
      email: valueOf("email").toLowerCase(),
      phone: valueOf("phone") || undefined,
      title: valueOf("title") || undefined,
      password: valueOf("password") || undefined,
      departmentCode: valueOf("departmentCode") || undefined,
      managerEmployeeCode: valueOf("managerEmployeeCode") || undefined,
      roleCodes: splitCodes(valueOf("roleCodes")),
      teamCodes: splitCodes(valueOf("teamCodes"))
    };
  });
}

export function buildUserImportPreview(records: UserImportRecord[], references: UserImportReferenceData): UserImportPreview {
  const seenEmployeeCodes = new Set<string>();
  const seenEmails = new Set<string>();
  const fileEmployeeCodes = new Set(records.map((record) => record.employeeCode.toLowerCase()).filter(Boolean));

  const rows = records.map((record) => {
    const errors: string[] = [];
    const employeeCodeKey = record.employeeCode.toLowerCase();
    const emailKey = record.email.toLowerCase();

    if (!record.employeeCode) errors.push("Thiếu mã nhân viên.");
    if (!record.fullName) errors.push("Thiếu họ tên.");
    if (!record.email) errors.push("Thiếu email.");
    if (record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
      errors.push("Email không hợp lệ.");
    }
    if (record.password && record.password.length < 8) {
      errors.push("Mật khẩu phải có ít nhất 8 ký tự.");
    }
    if (record.employeeCode && seenEmployeeCodes.has(employeeCodeKey)) {
      errors.push("Mã nhân viên bị trùng trong file.");
    }
    if (record.email && seenEmails.has(emailKey)) {
      errors.push("Email bị trùng trong file.");
    }
    if (record.employeeCode && references.existingEmployeeCodes.has(employeeCodeKey)) {
      errors.push("Mã nhân viên đã tồn tại trong hệ thống.");
    }
    if (record.email && references.existingEmails.has(emailKey)) {
      errors.push("Email đã tồn tại trong hệ thống.");
    }
    if (record.departmentCode && !references.departmentCodes.has(record.departmentCode.toLowerCase())) {
      errors.push(`Không tìm thấy phòng ban ${record.departmentCode}.`);
    }
    if (record.managerEmployeeCode && record.managerEmployeeCode.toLowerCase() === employeeCodeKey) {
      errors.push("Quản lý trực tiếp không được trùng chính nhân viên.");
    }
    if (
      record.managerEmployeeCode &&
      !references.managerEmployeeCodes.has(record.managerEmployeeCode.toLowerCase()) &&
      !fileEmployeeCodes.has(record.managerEmployeeCode.toLowerCase())
    ) {
      errors.push(`Không tìm thấy quản lý ${record.managerEmployeeCode}.`);
    }
    for (const roleCode of record.roleCodes) {
      if (!references.roleCodes.has(roleCode.toLowerCase())) {
        errors.push(`Không tìm thấy vai trò ${roleCode}.`);
      }
    }
    for (const teamCode of record.teamCodes) {
      if (!references.teamCodes.has(teamCode.toLowerCase())) {
        errors.push(`Không tìm thấy nhóm ${teamCode}.`);
      }
    }

    if (record.employeeCode) seenEmployeeCodes.add(employeeCodeKey);
    if (record.email) seenEmails.add(emailKey);

    return {
      ...record,
      status: errors.length > 0 ? "ERROR" : "VALID",
      errors
    } satisfies UserImportPreviewRow;
  });

  const valid = rows.filter((row) => row.status === "VALID").length;
  return {
    rows,
    summary: {
      total: rows.length,
      valid,
      invalid: rows.length - valid
    },
    canApply: rows.length > 0 && rows.length === valid
  };
}
