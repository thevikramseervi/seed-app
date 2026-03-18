-- One-off DDL to create activity_entries table to match Prisma ActivityEntry model

CREATE TABLE IF NOT EXISTS "activity_entries" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "user_type" TEXT NOT NULL,
  "project" TEXT NOT NULL,
  "task" TEXT NOT NULL,
  "sub_task" TEXT,
  "unit" TEXT NOT NULL,
  "nos" INTEGER NOT NULL,
  "percentage" DECIMAL(5, 2) NOT NULL,
  "productivity" DECIMAL(10, 2) NOT NULL,
  "weightage" DECIMAL(10, 2) NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "activity_entries_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "activity_entries"
  ADD CONSTRAINT "activity_entries_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "activity_entries"
  ADD CONSTRAINT "activity_entries_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes for reporting
CREATE INDEX "activity_entries_date_user_id_idx" ON "activity_entries"("date", "user_id");
CREATE INDEX "activity_entries_user_id_date_idx" ON "activity_entries"("user_id", "date");

