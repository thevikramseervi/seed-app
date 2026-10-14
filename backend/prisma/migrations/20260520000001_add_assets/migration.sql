-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "asset_name" TEXT NOT NULL,
    "asset_type" "AssetType" NOT NULL,
    "asset_number" TEXT NOT NULL,
    "serial_number" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assets_asset_number_key" ON "assets"("asset_number");

-- CreateIndex
CREATE INDEX "assets_user_id_idx" ON "assets"("user_id");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
