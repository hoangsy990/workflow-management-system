CREATE TYPE "SharedCatalogStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TYPE "SharedCatalogFieldType" AS ENUM (
  'SHORT_TEXT',
  'NUMBER',
  'CURRENCY',
  'DATE',
  'BOOLEAN',
  'SELECT',
  'USER_SELECT',
  'DEPARTMENT_SELECT'
);

CREATE TABLE "shared_catalogs" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "SharedCatalogStatus" NOT NULL DEFAULT 'ACTIVE',
  "scope_department_id" TEXT,
  "manager_id" TEXT,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "shared_catalogs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shared_catalog_fields" (
  "id" TEXT NOT NULL,
  "catalog_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "SharedCatalogFieldType" NOT NULL DEFAULT 'SHORT_TEXT',
  "is_required" BOOLEAN NOT NULL DEFAULT false,
  "options" JSONB,
  "default_value" JSONB,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shared_catalog_fields_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shared_catalog_items" (
  "id" TEXT NOT NULL,
  "catalog_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "SharedCatalogStatus" NOT NULL DEFAULT 'ACTIVE',
  "scope_department_id" TEXT,
  "manager_id" TEXT,
  "values" JSONB,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "shared_catalog_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shared_catalogs_code_key" ON "shared_catalogs"("code");
CREATE INDEX "shared_catalogs_status_deleted_at_idx" ON "shared_catalogs"("status", "deleted_at");
CREATE INDEX "shared_catalogs_scope_department_id_idx" ON "shared_catalogs"("scope_department_id");
CREATE INDEX "shared_catalogs_manager_id_idx" ON "shared_catalogs"("manager_id");

CREATE UNIQUE INDEX "shared_catalog_fields_catalog_id_code_key" ON "shared_catalog_fields"("catalog_id", "code");
CREATE INDEX "shared_catalog_fields_catalog_id_display_order_idx" ON "shared_catalog_fields"("catalog_id", "display_order");

CREATE UNIQUE INDEX "shared_catalog_items_catalog_id_code_key" ON "shared_catalog_items"("catalog_id", "code");
CREATE INDEX "shared_catalog_items_catalog_id_status_deleted_at_idx" ON "shared_catalog_items"("catalog_id", "status", "deleted_at");
CREATE INDEX "shared_catalog_items_scope_department_id_idx" ON "shared_catalog_items"("scope_department_id");
CREATE INDEX "shared_catalog_items_manager_id_idx" ON "shared_catalog_items"("manager_id");

ALTER TABLE "shared_catalogs" ADD CONSTRAINT "shared_catalogs_scope_department_id_fkey" FOREIGN KEY ("scope_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shared_catalogs" ADD CONSTRAINT "shared_catalogs_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shared_catalogs" ADD CONSTRAINT "shared_catalogs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shared_catalog_fields" ADD CONSTRAINT "shared_catalog_fields_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "shared_catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shared_catalog_items" ADD CONSTRAINT "shared_catalog_items_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "shared_catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shared_catalog_items" ADD CONSTRAINT "shared_catalog_items_scope_department_id_fkey" FOREIGN KEY ("scope_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shared_catalog_items" ADD CONSTRAINT "shared_catalog_items_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shared_catalog_items" ADD CONSTRAINT "shared_catalog_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
