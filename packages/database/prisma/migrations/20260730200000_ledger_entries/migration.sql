-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "subcategory_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "kind" "CategoryType" NOT NULL,
    "description" TEXT NOT NULL,
    "amount_in_cents" BIGINT NOT NULL,
    "occurred_on" DATE NOT NULL,
    "competence_year" INTEGER NOT NULL,
    "competence_month" INTEGER NOT NULL,
    "attributed_member_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "voided_at" TIMESTAMP(3),
    "voided_by_user_id" UUID,
    "void_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint on workspace_members(id, workspace_id) for composite FK
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_members_id_workspace_id_key" ON "workspace_members"("id", "workspace_id");

-- CreateIndexes
CREATE INDEX "ledger_entries_workspace_id_competence_year_competence_month_idx" ON "ledger_entries"("workspace_id", "competence_year", "competence_month");
CREATE INDEX "ledger_entries_workspace_id_occurred_on_idx" ON "ledger_entries"("workspace_id", "occurred_on");
CREATE INDEX "ledger_entries_workspace_id_subcategory_id_idx" ON "ledger_entries"("workspace_id", "subcategory_id");
CREATE INDEX "ledger_entries_workspace_id_kind_idx" ON "ledger_entries"("workspace_id", "kind");
CREATE INDEX "ledger_entries_workspace_id_attributed_member_id_idx" ON "ledger_entries"("workspace_id", "attributed_member_id");
CREATE INDEX "ledger_entries_created_by_user_id_idx" ON "ledger_entries"("created_by_user_id");

-- AddForeignKey: workspace
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: subcategory (composite with workspace)
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_subcategory_id_workspace_id_fkey" FOREIGN KEY ("subcategory_id", "workspace_id") REFERENCES "subcategories"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: attributedMember (composite with workspace, optional)
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_attributed_member_id_workspace_id_fkey" FOREIGN KEY ("attributed_member_id", "workspace_id") REFERENCES "workspace_members"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: createdBy
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: voidedBy
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_voided_by_user_id_fkey" FOREIGN KEY ("voided_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraints
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_amount_positive" CHECK ("amount_in_cents" > 0);
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_competence_month_range" CHECK ("competence_month" BETWEEN 1 AND 12);
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_competence_year_range" CHECK ("competence_year" BETWEEN 2000 AND 2100);
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_version_positive" CHECK ("version" >= 1);
