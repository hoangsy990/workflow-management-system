const headerAliases = {
  code: ["code", "ma", "ma_gia_tri", "ma gia tri"],
  name: ["name", "ten", "ten_hien_thi", "ten hien thi"],
  status: ["status", "trang_thai", "trang thai"],
  departmentCode: ["departmentCode", "department_code", "ma_phong_ban", "ma phong ban", "department"],
  managerEmployeeCode: ["managerEmployeeCode", "manager_employee_code", "ma_quan_ly", "ma quan ly", "manager"]
} as const;

export interface CatalogItemImportRecord {
  rowNumber: number;
  code: string;
  name: string;
  statusText?: string;
  departmentCode?: string;
  managerEmployeeCode?: string;
}

export interface CatalogItemImportPreviewRow extends CatalogItemImportRecord {
  statusValue: "ACTIVE" | "INACTIVE";
  status: "VALID" | "ERROR";
  errors: string[];
}

export interface CatalogItemImportReferenceData {
  existingCodes: Set<string>;
  departmentCodes: Set<string>;
  managerEmployeeCodes: Set<string>;
}

export interface CatalogItemImportPreview {
  rows: CatalogItemImportPreviewRow[];
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

function normalizeStatus(value?: string): "ACTIVE" | "INACTIVE" | null {
  const normalized = normalizeValue(value).toLowerCase();
  if (!normalized || ["active", "dang_dung", "dang dung", "hoat_dong", "hoat dong"].includes(normalized)) return "ACTIVE";
  if (["inactive", "tam_dung", "tam dung", "ngung", "ngung_dung", "ngung dung"].includes(normalized)) return "INACTIVE";
  return null;
}

export function parseCatalogItemImportCsv(csv: string): CatalogItemImportRecord[] {
  const normalizedCsv = csv.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalizedCsv.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0] ?? "").map(normalizeHeader);
  const fieldIndexes = {} as Record<keyof typeof headerAliases, number>;
  for (const field of Object.keys(headerAliases) as Array<keyof typeof headerAliases>) {
    const normalizedAliases = headerAliases[field].map(normalizeHeader);
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
      code: valueOf("code"),
      name: valueOf("name"),
      statusText: valueOf("status") || undefined,
      departmentCode: valueOf("departmentCode") || undefined,
      managerEmployeeCode: valueOf("managerEmployeeCode") || undefined
    };
  });
}

export function buildCatalogItemImportPreview(records: CatalogItemImportRecord[], references: CatalogItemImportReferenceData): CatalogItemImportPreview {
  const seenCodes = new Set<string>();
  const rows = records.map((record) => {
    const errors: string[] = [];
    const codeKey = record.code.toLowerCase();
    const statusValue = normalizeStatus(record.statusText);

    if (!record.code) errors.push("Thiếu mã giá trị.");
    if (!record.name) errors.push("Thiếu tên hiển thị.");
    if (record.code && seenCodes.has(codeKey)) errors.push("Mã giá trị bị trùng trong file.");
    if (record.code && references.existingCodes.has(codeKey)) errors.push("Mã giá trị đã tồn tại trong catalog.");
    if (!statusValue) errors.push("Trạng thái không hợp lệ.");
    if (record.departmentCode && !references.departmentCodes.has(record.departmentCode.toLowerCase())) {
      errors.push(`Không tìm thấy phòng ban ${record.departmentCode}.`);
    }
    if (record.managerEmployeeCode && !references.managerEmployeeCodes.has(record.managerEmployeeCode.toLowerCase())) {
      errors.push(`Không tìm thấy quản lý ${record.managerEmployeeCode}.`);
    }

    if (record.code) seenCodes.add(codeKey);

    return {
      ...record,
      statusValue: statusValue ?? "ACTIVE",
      status: errors.length > 0 ? "ERROR" : "VALID",
      errors
    } satisfies CatalogItemImportPreviewRow;
  });

  const valid = rows.filter((row) => row.status === "VALID").length;
  return {
    rows,
    summary: { total: rows.length, valid, invalid: rows.length - valid },
    canApply: rows.length > 0 && rows.length === valid
  };
}
