-- CreateTable
CREATE TABLE "monthly_plans" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_plan_items" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "monthly_plan_id" UUID NOT NULL,
    "subcategory_id" UUID NOT NULL,
    "planned_amount_in_cents" BIGINT NOT NULL,

    CONSTRAINT "monthly_plan_items_pkey" PRIMARY KEY ("id")
);

-- Composite unique: one plan per workspace+year+month
CREATE UNIQUE INDEX "monthly_plans_workspace_id_year_month_key" ON "monthly_plans"("workspace_id", "year", "month");

-- Composite unique for FK from items
CREATE UNIQUE INDEX "monthly_plans_id_workspace_id_key" ON "monthly_plans"("id", "workspace_id");

-- Composite unique for subcategory FK from items
CREATE UNIQUE INDEX "subcategories_id_workspace_id_key" ON "subcategories"("id", "workspace_id");

-- One item per plan+subcategory
CREATE UNIQUE INDEX "monthly_plan_items_monthly_plan_id_subcategory_id_key" ON "monthly_plan_items"("monthly_plan_id", "subcategory_id");

-- Indexes
CREATE INDEX "monthly_plans_workspace_id_idx" ON "monthly_plans"("workspace_id");
CREATE INDEX "monthly_plan_items_workspace_id_idx" ON "monthly_plan_items"("workspace_id");
CREATE INDEX "monthly_plan_items_monthly_plan_id_idx" ON "monthly_plan_items"("monthly_plan_id");
CREATE INDEX "monthly_plan_items_subcategory_id_idx" ON "monthly_plan_items"("subcategory_id");

-- CHECK constraints
ALTER TABLE "monthly_plans" ADD CONSTRAINT "monthly_plans_month_check" CHECK ("month" BETWEEN 1 AND 12);
ALTER TABLE "monthly_plans" ADD CONSTRAINT "monthly_plans_year_check" CHECK ("year" BETWEEN 2000 AND 2100);
ALTER TABLE "monthly_plan_items" ADD CONSTRAINT "monthly_plan_items_amount_check" CHECK ("planned_amount_in_cents" >= 0);

-- Foreign keys
ALTER TABLE "monthly_plans" ADD CONSTRAINT "monthly_plans_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "monthly_plans" ADD CONSTRAINT "monthly_plans_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "monthly_plans" ADD CONSTRAINT "monthly_plans_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "monthly_plan_items" ADD CONSTRAINT "monthly_plan_items_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "monthly_plan_items" ADD CONSTRAINT "monthly_plan_items_plan_fkey" FOREIGN KEY ("monthly_plan_id", "workspace_id") REFERENCES "monthly_plans"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "monthly_plan_items" ADD CONSTRAINT "monthly_plan_items_subcategory_fkey" FOREIGN KEY ("subcategory_id", "workspace_id") REFERENCES "subcategories"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;
