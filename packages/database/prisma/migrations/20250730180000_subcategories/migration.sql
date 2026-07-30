-- CreateTable
CREATE TABLE "subcategories" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subcategories_workspace_id_idx" ON "subcategories"("workspace_id");

-- CreateIndex
CREATE INDEX "subcategories_category_id_idx" ON "subcategories"("category_id");

-- CreateIndex
CREATE INDEX "subcategories_workspace_id_is_active_idx" ON "subcategories"("workspace_id", "is_active");

-- CreateIndex
CREATE INDEX "subcategories_category_id_is_active_idx" ON "subcategories"("category_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "subcategories_workspace_id_category_id_normalized_name_key" ON "subcategories"("workspace_id", "category_id", "normalized_name");

-- AddForeignKey
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
