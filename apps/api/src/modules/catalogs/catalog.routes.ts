import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { parseBody, parseParams } from "../../http/validation.js";
import { requireAuth, requirePermission } from "../auth/auth.guard.js";
import {
  createSharedCatalog,
  createSharedCatalogItem,
  deleteSharedCatalog,
  deleteSharedCatalogItem,
  importSharedCatalogItemsFromCsv,
  listSharedCatalogOptions,
  listSharedCatalogs,
  updateSharedCatalog,
  updateSharedCatalogItem
} from "./catalog.service.js";

const idParamSchema = z.object({ id: z.string().uuid() });
const catalogIdOrCodeParamSchema = z.object({ idOrCode: z.string().trim().min(1) });

const catalogFieldSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  type: z.enum(["SHORT_TEXT", "NUMBER", "CURRENCY", "DATE", "BOOLEAN", "SELECT", "USER_SELECT", "DEPARTMENT_SELECT"]).default("SHORT_TEXT"),
  isRequired: z.boolean().optional(),
  options: z.unknown().optional(),
  defaultValue: z.unknown().optional(),
  displayOrder: z.number().int().optional()
});

const catalogSchema = z.object({
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(500).nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  scopeDepartmentId: z.string().uuid().nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  fields: z.array(catalogFieldSchema).max(50).default([])
});

const catalogItemSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  scopeDepartmentId: z.string().uuid().nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  values: z.unknown().optional()
});

const catalogItemImportSchema = z.object({
  csv: z.string().min(1).max(1_000_000),
  apply: z.boolean().optional()
});

export async function catalogRoutes(app: FastifyInstance) {
  app.get("/shared-catalogs", { preHandler: requireAuth }, async (request) => listSharedCatalogs(prisma, request.auth!));

  app.post("/shared-catalogs", { preHandler: requirePermission("catalog.manage") }, async (request) => {
    const body = parseBody(request, catalogSchema);
    return createSharedCatalog(prisma, request.auth!, body, request.ip);
  });

  app.patch("/shared-catalogs/:id", { preHandler: requirePermission("catalog.manage") }, async (request) => {
    const params = parseParams(request, idParamSchema);
    const body = parseBody(request, catalogSchema.partial());
    return updateSharedCatalog(prisma, request.auth!, params.id, body, request.ip);
  });

  app.delete("/shared-catalogs/:id", { preHandler: requirePermission("catalog.manage") }, async (request) => {
    const params = parseParams(request, idParamSchema);
    return deleteSharedCatalog(prisma, request.auth!, params.id, request.ip);
  });

  app.post("/shared-catalogs/:id/items", { preHandler: requirePermission("catalog.manage") }, async (request) => {
    const params = parseParams(request, idParamSchema);
    const body = parseBody(request, catalogItemSchema);
    return createSharedCatalogItem(prisma, request.auth!, params.id, body, request.ip);
  });

  app.post("/shared-catalogs/:id/items/import", { preHandler: requirePermission("catalog.manage") }, async (request) => {
    const params = parseParams(request, idParamSchema);
    const body = parseBody(request, catalogItemImportSchema);
    return importSharedCatalogItemsFromCsv(prisma, request.auth!, params.id, body, request.ip);
  });

  app.patch("/shared-catalog-items/:id", { preHandler: requirePermission("catalog.manage") }, async (request) => {
    const params = parseParams(request, idParamSchema);
    const body = parseBody(request, catalogItemSchema.partial());
    return updateSharedCatalogItem(prisma, request.auth!, params.id, body, request.ip);
  });

  app.delete("/shared-catalog-items/:id", { preHandler: requirePermission("catalog.manage") }, async (request) => {
    const params = parseParams(request, idParamSchema);
    return deleteSharedCatalogItem(prisma, request.auth!, params.id, request.ip);
  });

  app.get("/shared-catalogs/:idOrCode/options", { preHandler: requireAuth }, async (request) => {
    const params = parseParams(request, catalogIdOrCodeParamSchema);
    return listSharedCatalogOptions(prisma, request.auth!, params.idOrCode);
  });
}
