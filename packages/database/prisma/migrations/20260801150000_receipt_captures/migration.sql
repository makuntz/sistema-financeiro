-- CreateEnum
CREATE TYPE "ReceiptCaptureStatus" AS ENUM ('draft', 'uploaded', 'processing', 'review', 'confirmed', 'failed', 'canceled');

-- CreateEnum
CREATE TYPE "ReceiptProcessingJobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'retryScheduled');

-- CreateEnum
CREATE TYPE "LedgerEntryOrigin" AS ENUM ('manual', 'receipt');

-- AlterTable
ALTER TABLE "ledger_entries"
  ADD COLUMN "origin" "LedgerEntryOrigin" NOT NULL DEFAULT 'manual',
  ADD COLUMN "receipt_capture_id" UUID;

-- CreateTable
CREATE TABLE "receipt_captures" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "status" "ReceiptCaptureStatus" NOT NULL DEFAULT 'draft',
    "merchant_name" TEXT,
    "purchase_date" DATE,
    "total_amount_in_cents" BIGINT,
    "default_category_id" UUID,
    "extraction_provider" TEXT NOT NULL DEFAULT 'fake',
    "extraction_version" TEXT,
    "fake_scenario" TEXT,
    "processing_started_at" TIMESTAMP(3),
    "processing_completed_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "confirmed_by_user_id" UUID,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_captures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_images" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "receipt_capture_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_in_bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "upload_completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_items" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "receipt_capture_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "raw_description" TEXT NOT NULL,
    "normalized_description" TEXT,
    "quantity" TEXT,
    "unit_of_measure" TEXT,
    "unit_price_in_cents" BIGINT,
    "line_total_in_cents" BIGINT,
    "selected_subcategory_id" UUID,
    "is_ignored" BOOLEAN NOT NULL DEFAULT false,
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_processing_jobs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "receipt_capture_id" UUID NOT NULL,
    "status" "ReceiptProcessingJobStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "next_retry_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receipt_captures_id_workspace_id_key" ON "receipt_captures"("id", "workspace_id");
CREATE INDEX "receipt_captures_workspace_id_idx" ON "receipt_captures"("workspace_id");
CREATE INDEX "receipt_captures_workspace_id_status_idx" ON "receipt_captures"("workspace_id", "status");
CREATE INDEX "receipt_captures_workspace_id_created_at_idx" ON "receipt_captures"("workspace_id", "created_at");
CREATE INDEX "receipt_captures_created_by_user_id_idx" ON "receipt_captures"("created_by_user_id");

CREATE UNIQUE INDEX "receipt_images_receipt_capture_id_position_key" ON "receipt_images"("receipt_capture_id", "position");
CREATE INDEX "receipt_images_receipt_capture_id_idx" ON "receipt_images"("receipt_capture_id");
CREATE INDEX "receipt_images_receipt_capture_id_position_idx" ON "receipt_images"("receipt_capture_id", "position");
CREATE INDEX "receipt_images_workspace_id_idx" ON "receipt_images"("workspace_id");

CREATE UNIQUE INDEX "receipt_items_receipt_capture_id_position_key" ON "receipt_items"("receipt_capture_id", "position");
CREATE INDEX "receipt_items_receipt_capture_id_idx" ON "receipt_items"("receipt_capture_id");
CREATE INDEX "receipt_items_selected_subcategory_id_idx" ON "receipt_items"("selected_subcategory_id");
CREATE INDEX "receipt_items_receipt_capture_id_position_idx" ON "receipt_items"("receipt_capture_id", "position");
CREATE INDEX "receipt_items_workspace_id_idx" ON "receipt_items"("workspace_id");

CREATE INDEX "receipt_processing_jobs_status_next_retry_at_idx" ON "receipt_processing_jobs"("status", "next_retry_at");
CREATE INDEX "receipt_processing_jobs_receipt_capture_id_idx" ON "receipt_processing_jobs"("receipt_capture_id");
CREATE INDEX "receipt_processing_jobs_locked_at_idx" ON "receipt_processing_jobs"("locked_at");
CREATE INDEX "receipt_processing_jobs_workspace_id_idx" ON "receipt_processing_jobs"("workspace_id");

CREATE INDEX "ledger_entries_workspace_id_receipt_capture_id_idx" ON "ledger_entries"("workspace_id", "receipt_capture_id");

-- AddForeignKey
ALTER TABLE "receipt_captures" ADD CONSTRAINT "receipt_captures_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receipt_captures" ADD CONSTRAINT "receipt_captures_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receipt_captures" ADD CONSTRAINT "receipt_captures_confirmed_by_user_id_fkey" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receipt_captures" ADD CONSTRAINT "receipt_captures_default_category_id_fkey" FOREIGN KEY ("default_category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "receipt_images" ADD CONSTRAINT "receipt_images_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receipt_images" ADD CONSTRAINT "receipt_images_receipt_capture_id_workspace_id_fkey" FOREIGN KEY ("receipt_capture_id", "workspace_id") REFERENCES "receipt_captures"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "receipt_items" ADD CONSTRAINT "receipt_items_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receipt_items" ADD CONSTRAINT "receipt_items_receipt_capture_id_workspace_id_fkey" FOREIGN KEY ("receipt_capture_id", "workspace_id") REFERENCES "receipt_captures"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receipt_items" ADD CONSTRAINT "receipt_items_selected_subcategory_id_workspace_id_fkey" FOREIGN KEY ("selected_subcategory_id", "workspace_id") REFERENCES "subcategories"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "receipt_processing_jobs" ADD CONSTRAINT "receipt_processing_jobs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receipt_processing_jobs" ADD CONSTRAINT "receipt_processing_jobs_receipt_capture_id_workspace_id_fkey" FOREIGN KEY ("receipt_capture_id", "workspace_id") REFERENCES "receipt_captures"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_receipt_capture_id_workspace_id_fkey" FOREIGN KEY ("receipt_capture_id", "workspace_id") REFERENCES "receipt_captures"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;
