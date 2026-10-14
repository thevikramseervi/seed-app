-- CreateEnum
CREATE TYPE "AssetAction" AS ENUM ('ASSIGNED', 'RETURNED', 'REASSIGNED', 'DELETED');

-- CreateTable
CREATE TABLE "asset_histories" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "asset_number" TEXT NOT NULL,
    "asset_name" TEXT NOT NULL,
    "asset_type" "AssetType" NOT NULL,
    "serial_number" TEXT,
    "user_id" TEXT,
    "employee_name" TEXT,
    "employee_id" TEXT,
    "action" "AssetAction" NOT NULL,
    "performed_by" TEXT NOT NULL,
    "performed_by_name" TEXT NOT NULL,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_histories_asset_id_idx" ON "asset_histories"("asset_id");

-- CreateIndex
CREATE INDEX "asset_histories_user_id_idx" ON "asset_histories"("user_id");

-- CreateIndex
CREATE INDEX "asset_histories_created_at_idx" ON "asset_histories"("created_at");
