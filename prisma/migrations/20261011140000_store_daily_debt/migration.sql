-- CreateTable
CREATE TABLE "store_daily_debt" (
    "id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "store_daily_debt_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "store_daily_debt_date_idx" ON "store_daily_debt"("date");
-- CreateIndex
CREATE UNIQUE INDEX "store_daily_debt_department_date_name_key" ON "store_daily_debt"("department", "date", "name");
