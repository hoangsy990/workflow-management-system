import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuthContext } from "../../types/fastify.js";
import { conflict, notFound } from "../../http/errors.js";
import { writeAuditLog } from "../audit/audit.service.js";
import {
  buildCatalogItemImportPreview,
  parseCatalogItemImportCsv,
  type CatalogItemImportPreviewRow
} from "./catalog-import.js";

type Db = PrismaClient | Prisma.TransactionClient;

export interface SharedCatalogFieldInput {
  code: string;
  name: string;
  type?: string;
  isRequired?: boolean;
  options?: unknown;
  defaultValue?: unknown;
  displayOrder?: number;
}

export interface SharedCatalogInput {
  code: string;
  name: string;
  description?: string | null;
  status?: "ACTIVE" | "INACTIVE";
  scopeDepartmentId?: string | null;
  managerId?: string | null;
  fields?: SharedCatalogFieldInput[];
}

export interface SharedCatalogItemInput {
  code: string;
  name: string;
  status?: "ACTIVE" | "INACTIVE";
  scopeDepartmentId?: string | null;
  managerId?: string | null;
  values?: unknown;
}

function hasPermission(auth: AuthContext, permission: string) {
  return auth.permissions.includes(permission);
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeFieldCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

function lowerKey(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function departmentScopeFilter(departmentId?: string | null) {
  return departmentId ? [{ scopeDepartmentId: null }, { scopeDepartmentId: departmentId }] : [{ scopeDepartmentId: null }];
}

function visibleCatalogWhere(auth: AuthContext): Prisma.SharedCatalogWhereInput {
  if (hasPermission(auth, "catalog.manage")) {
    return { deletedAt: null };
  }
  return {
    deletedAt: null,
    status: "ACTIVE",
    OR: departmentScopeFilter(auth.departmentId)
  };
}

export async function listSharedCatalogs(db: Db, auth: AuthContext) {
  return db.sharedCatalog.findMany({
    where: visibleCatalogWhere(auth),
    orderBy: { name: "asc" },
    include: {
      fields: { orderBy: { displayOrder: "asc" } },
      items: {
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          updatedAt: true,
          scopeDepartmentId: true,
          managerId: true,
          scopeDepartment: { select: { id: true, code: true, name: true } },
          manager: { select: { id: true, fullName: true } }
        }
      },
      scopeDepartment: { select: { id: true, code: true, name: true } },
      manager: { select: { id: true, fullName: true } },
      _count: { select: { items: true } }
    }
  });
}

export async function updateSharedCatalog(db: PrismaClient, auth: AuthContext, id: string, input: Partial<SharedCatalogInput>, ipAddress?: string) {
  const fieldCodes = input.fields?.map((field) => normalizeFieldCode(field.code)).filter(Boolean) ?? [];
  if (new Set(fieldCodes).size !== fieldCodes.length) {
    throw conflict("MÃ£ field danh má»¥c khÃ´ng Ä‘Æ°á»£c trÃ¹ng.");
  }

  return db.$transaction(async (tx) => {
    const current = await tx.sharedCatalog.findFirst({ where: { id, deletedAt: null }, include: { fields: true } });
    if (!current) throw notFound("KhÃ´ng tÃ¬m tháº¥y danh má»¥c tÃ¹y chá»‰nh.");

    const code = input.code ? normalizeCode(input.code) : current.code;
    const duplicate = await tx.sharedCatalog.findFirst({ where: { deletedAt: null, id: { not: id }, code } });
    if (duplicate) {
      throw conflict("MÃ£ danh má»¥c tÃ¹y chá»‰nh Ä‘Ã£ tá»“n táº¡i.");
    }

    if (input.fields) {
      await tx.sharedCatalogField.deleteMany({ where: { catalogId: id } });
      await tx.sharedCatalogField.createMany({
        data: input.fields.map((field, index) => ({
          catalogId: id,
          code: normalizeFieldCode(field.code),
          name: field.name.trim(),
          type: (field.type ?? "SHORT_TEXT") as never,
          isRequired: field.isRequired ?? false,
          options: field.options as Prisma.InputJsonValue | undefined,
          defaultValue: field.defaultValue as Prisma.InputJsonValue | undefined,
          displayOrder: field.displayOrder ?? index + 1
        }))
      });
    }

    const catalog = await tx.sharedCatalog.update({
      where: { id },
      data: {
        code,
        name: input.name === undefined ? current.name : input.name.trim(),
        description: input.description === undefined ? current.description : input.description?.trim() || null,
        status: input.status ?? current.status,
        scopeDepartmentId: input.scopeDepartmentId === undefined ? current.scopeDepartmentId : input.scopeDepartmentId || null,
        managerId: input.managerId === undefined ? current.managerId : input.managerId || null
      },
      include: { fields: { orderBy: { displayOrder: "asc" } } }
    });

    await writeAuditLog(tx, {
      actorId: auth.userId,
      action: "shared_catalog.update",
      entityType: "shared_catalogs",
      entityId: catalog.id,
      ipAddress,
      metadata: {
        previous: { code: current.code, name: current.name, status: current.status, fieldCount: current.fields.length },
        next: { code: catalog.code, name: catalog.name, status: catalog.status, fieldCount: catalog.fields.length }
      }
    });

    return catalog;
  });
}

export async function deleteSharedCatalog(db: PrismaClient, auth: AuthContext, id: string, ipAddress?: string) {
  return db.$transaction(async (tx) => {
    const current = await tx.sharedCatalog.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw notFound("KhÃ´ng tÃ¬m tháº¥y danh má»¥c tÃ¹y chá»‰nh.");

    const deletedAt = new Date();
    await tx.sharedCatalog.update({ where: { id }, data: { deletedAt, status: "INACTIVE" } });
    await tx.sharedCatalogItem.updateMany({ where: { catalogId: id, deletedAt: null }, data: { deletedAt, status: "INACTIVE" } });

    await writeAuditLog(tx, {
      actorId: auth.userId,
      action: "shared_catalog.delete",
      entityType: "shared_catalogs",
      entityId: id,
      ipAddress,
      metadata: { code: current.code, name: current.name }
    });

    return { ok: true };
  });
}

export async function createSharedCatalog(db: PrismaClient, auth: AuthContext, input: SharedCatalogInput, ipAddress?: string) {
  const code = normalizeCode(input.code);
  const fieldCodes = (input.fields ?? []).map((field) => normalizeFieldCode(field.code)).filter(Boolean);
  if (new Set(fieldCodes).size !== fieldCodes.length) {
    throw conflict("Mã field danh mục không được trùng.");
  }

  return db.$transaction(async (tx) => {
    const duplicate = await tx.sharedCatalog.findFirst({ where: { deletedAt: null, code } });
    if (duplicate) {
      throw conflict("Mã danh mục tùy chỉnh đã tồn tại.");
    }

    const catalog = await tx.sharedCatalog.create({
      data: {
        code,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        status: input.status ?? "ACTIVE",
        scopeDepartmentId: input.scopeDepartmentId || null,
        managerId: input.managerId || null,
        createdById: auth.userId,
        fields: {
          create: (input.fields ?? []).map((field, index) => ({
            code: normalizeFieldCode(field.code),
            name: field.name.trim(),
            type: (field.type ?? "SHORT_TEXT") as never,
            isRequired: field.isRequired ?? false,
            options: field.options as Prisma.InputJsonValue | undefined,
            defaultValue: field.defaultValue as Prisma.InputJsonValue | undefined,
            displayOrder: field.displayOrder ?? index + 1
          }))
        }
      },
      include: { fields: { orderBy: { displayOrder: "asc" } } }
    });

    await writeAuditLog(tx, {
      actorId: auth.userId,
      action: "shared_catalog.create",
      entityType: "shared_catalogs",
      entityId: catalog.id,
      ipAddress,
      metadata: { code: catalog.code, name: catalog.name, fieldCount: catalog.fields.length }
    });

    return catalog;
  });
}

export async function createSharedCatalogItem(db: PrismaClient, auth: AuthContext, catalogId: string, input: SharedCatalogItemInput, ipAddress?: string) {
  const code = normalizeCode(input.code);

  return db.$transaction(async (tx) => {
    const catalog = await tx.sharedCatalog.findFirst({ where: { id: catalogId, deletedAt: null } });
    if (!catalog) throw notFound("Không tìm thấy danh mục tùy chỉnh.");

    const duplicate = await tx.sharedCatalogItem.findFirst({ where: { catalogId, deletedAt: null, code } });
    if (duplicate) {
      throw conflict("Mã giá trị danh mục đã tồn tại.");
    }

    const item = await tx.sharedCatalogItem.create({
      data: {
        catalogId,
        code,
        name: input.name.trim(),
        status: input.status ?? "ACTIVE",
        scopeDepartmentId: input.scopeDepartmentId || catalog.scopeDepartmentId,
        managerId: input.managerId || catalog.managerId,
        values: input.values as Prisma.InputJsonValue | undefined,
        createdById: auth.userId
      }
    });

    await writeAuditLog(tx, {
      actorId: auth.userId,
      action: "shared_catalog_item.create",
      entityType: "shared_catalog_items",
      entityId: item.id,
      ipAddress,
      metadata: { catalogCode: catalog.code, code: item.code, name: item.name }
    });

    return item;
  });
}

export async function importSharedCatalogItemsFromCsv(
  db: PrismaClient,
  auth: AuthContext,
  catalogId: string,
  input: { csv: string; apply?: boolean },
  ipAddress?: string
) {
  const catalog = await db.sharedCatalog.findFirst({ where: { id: catalogId, deletedAt: null }, select: { id: true, code: true, scopeDepartmentId: true, managerId: true } });
  if (!catalog) throw notFound("Không tìm thấy danh mục tùy chỉnh.");

  const records = parseCatalogItemImportCsv(input.csv);
  const [items, departments, users] = await Promise.all([
    db.sharedCatalogItem.findMany({ where: { catalogId, deletedAt: null }, select: { code: true } }),
    db.department.findMany({ where: { deletedAt: null }, select: { id: true, code: true } }),
    db.user.findMany({ where: { deletedAt: null }, select: { id: true, employeeCode: true } })
  ]);
  const departmentsByCode = new Map(departments.map((department) => [lowerKey(department.code), department]));
  const usersByCode = new Map(users.map((user) => [lowerKey(user.employeeCode), user]));
  const preview = buildCatalogItemImportPreview(records, {
    existingCodes: new Set(items.map((item) => lowerKey(item.code))),
    departmentCodes: new Set(departments.map((department) => lowerKey(department.code))),
    managerEmployeeCodes: new Set(users.map((user) => lowerKey(user.employeeCode)))
  });

  if (!input.apply || !preview.canApply) {
    return { ...preview, applied: 0 };
  }

  const validRows = preview.rows.filter((row): row is CatalogItemImportPreviewRow & { status: "VALID" } => row.status === "VALID");
  const created = await db.$transaction(async (tx) => {
    for (const row of validRows) {
      await tx.sharedCatalogItem.create({
        data: {
          catalogId,
          code: normalizeCode(row.code),
          name: row.name.trim(),
          status: row.statusValue,
          scopeDepartmentId: row.departmentCode ? departmentsByCode.get(lowerKey(row.departmentCode))?.id : catalog.scopeDepartmentId,
          managerId: row.managerEmployeeCode ? usersByCode.get(lowerKey(row.managerEmployeeCode))?.id : catalog.managerId,
          createdById: auth.userId
        }
      });
    }

    await writeAuditLog(tx, {
      actorId: auth.userId,
      action: "shared_catalog_item.import",
      entityType: "shared_catalog_items",
      entityId: catalogId,
      ipAddress,
      metadata: {
        catalogCode: catalog.code,
        totalRows: preview.summary.total,
        importedRows: validRows.length
      }
    });

    return validRows.length;
  });

  return { ...preview, applied: created };
}

export async function updateSharedCatalogItem(db: PrismaClient, auth: AuthContext, id: string, input: Partial<SharedCatalogItemInput>, ipAddress?: string) {
  return db.$transaction(async (tx) => {
    const current = await tx.sharedCatalogItem.findFirst({ where: { id, deletedAt: null }, include: { catalog: true } });
    if (!current || current.catalog.deletedAt) throw notFound("KhÃ´ng tÃ¬m tháº¥y giÃ¡ trá»‹ danh má»¥c.");

    const code = input.code ? normalizeCode(input.code) : current.code;
    const duplicate = await tx.sharedCatalogItem.findFirst({
      where: { catalogId: current.catalogId, deletedAt: null, id: { not: id }, code }
    });
    if (duplicate) {
      throw conflict("MÃ£ giÃ¡ trá»‹ danh má»¥c Ä‘Ã£ tá»“n táº¡i.");
    }

    const item = await tx.sharedCatalogItem.update({
      where: { id },
      data: {
        code,
        name: input.name === undefined ? current.name : input.name.trim(),
        status: input.status ?? current.status,
        scopeDepartmentId: input.scopeDepartmentId === undefined ? current.scopeDepartmentId : input.scopeDepartmentId || null,
        managerId: input.managerId === undefined ? current.managerId : input.managerId || null,
        values: input.values === undefined ? undefined : (input.values as Prisma.InputJsonValue | undefined)
      }
    });

    await writeAuditLog(tx, {
      actorId: auth.userId,
      action: "shared_catalog_item.update",
      entityType: "shared_catalog_items",
      entityId: item.id,
      ipAddress,
      metadata: {
        catalogCode: current.catalog.code,
        previous: { code: current.code, name: current.name, status: current.status },
        next: { code: item.code, name: item.name, status: item.status }
      }
    });

    return item;
  });
}

export async function deleteSharedCatalogItem(db: PrismaClient, auth: AuthContext, id: string, ipAddress?: string) {
  return db.$transaction(async (tx) => {
    const current = await tx.sharedCatalogItem.findFirst({ where: { id, deletedAt: null }, include: { catalog: true } });
    if (!current || current.catalog.deletedAt) throw notFound("KhÃ´ng tÃ¬m tháº¥y giÃ¡ trá»‹ danh má»¥c.");

    await tx.sharedCatalogItem.update({ where: { id }, data: { deletedAt: new Date(), status: "INACTIVE" } });

    await writeAuditLog(tx, {
      actorId: auth.userId,
      action: "shared_catalog_item.delete",
      entityType: "shared_catalog_items",
      entityId: id,
      ipAddress,
      metadata: { catalogCode: current.catalog.code, code: current.code, name: current.name }
    });

    return { ok: true };
  });
}

export async function listSharedCatalogOptions(db: Db, auth: AuthContext, catalogIdOrCode: string) {
  const itemScopeWhere = hasPermission(auth, "catalog.manage") ? {} : { OR: departmentScopeFilter(auth.departmentId) };
  const catalog = await db.sharedCatalog.findFirst({
    where: {
      ...visibleCatalogWhere(auth),
      OR: [{ id: catalogIdOrCode }, { code: normalizeCode(catalogIdOrCode) }]
    },
    include: {
      items: {
        where: {
          deletedAt: null,
          status: "ACTIVE",
          ...itemScopeWhere
        },
        orderBy: { name: "asc" }
      }
    }
  });
  if (!catalog) throw notFound("Không tìm thấy danh mục tùy chỉnh.");

  return catalog.items.map((item) => ({
    value: item.code,
    label: item.name,
    values: item.values
  }));
}
