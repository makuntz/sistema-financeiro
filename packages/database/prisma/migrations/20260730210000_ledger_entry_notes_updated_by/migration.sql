-- AlterTable: notes + updated_by for ledger entries
ALTER TABLE "ledger_entries" ADD COLUMN "notes" TEXT;
ALTER TABLE "ledger_entries" ADD COLUMN "updated_by_user_id" UUID;

-- Backfill updated_by from created_by for existing rows
UPDATE "ledger_entries" SET "updated_by_user_id" = "created_by_user_id" WHERE "updated_by_user_id" IS NULL;

ALTER TABLE "ledger_entries" ALTER COLUMN "updated_by_user_id" SET NOT NULL;

-- Foreign key for updatedBy
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Additional indexes from Stage 5 brief
CREATE INDEX IF NOT EXISTS "ledger_entries_workspace_id_voided_at_idx" ON "ledger_entries"("workspace_id", "voided_at");
CREATE INDEX IF NOT EXISTS "ledger_entries_updated_at_idx" ON "ledger_entries"("updated_at");
