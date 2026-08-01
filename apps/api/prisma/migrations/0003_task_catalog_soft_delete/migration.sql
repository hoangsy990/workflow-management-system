ALTER TABLE "task_categories" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "tags" ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "task_categories_deleted_at_idx" ON "task_categories"("deleted_at");
CREATE INDEX "tags_deleted_at_idx" ON "tags"("deleted_at");
