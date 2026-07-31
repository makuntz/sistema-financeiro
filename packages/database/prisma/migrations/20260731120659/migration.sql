-- RenameForeignKey
ALTER TABLE "monthly_plan_items" RENAME CONSTRAINT "monthly_plan_items_plan_fkey" TO "monthly_plan_items_monthly_plan_id_workspace_id_fkey";

-- RenameForeignKey
ALTER TABLE "monthly_plan_items" RENAME CONSTRAINT "monthly_plan_items_subcategory_fkey" TO "monthly_plan_items_subcategory_id_workspace_id_fkey";

-- RenameIndex
ALTER INDEX "ledger_entries_workspace_id_competence_year_competence_month_id" RENAME TO "ledger_entries_workspace_id_competence_year_competence_mont_idx";
