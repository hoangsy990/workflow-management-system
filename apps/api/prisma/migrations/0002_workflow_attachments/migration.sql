-- CreateTable
CREATE TABLE "workflow_attachments" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "approval_id" TEXT,
    "uploaded_by_id" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "stored_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "workflow_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflow_attachments_instance_id_idx" ON "workflow_attachments"("instance_id");

-- CreateIndex
CREATE INDEX "workflow_attachments_approval_id_idx" ON "workflow_attachments"("approval_id");

-- CreateIndex
CREATE INDEX "workflow_attachments_uploaded_by_id_idx" ON "workflow_attachments"("uploaded_by_id");

-- AddForeignKey
ALTER TABLE "workflow_attachments" ADD CONSTRAINT "workflow_attachments_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "workflow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_attachments" ADD CONSTRAINT "workflow_attachments_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "workflow_approvals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_attachments" ADD CONSTRAINT "workflow_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
