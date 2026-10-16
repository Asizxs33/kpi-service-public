-- CreateTable
CREATE TABLE "store_daily_revenue" (
    "id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_daily_revenue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_daily_revenue_date_idx" ON "store_daily_revenue"("date");

-- CreateIndex
CREATE UNIQUE INDEX "store_daily_revenue_department_date_key" ON "store_daily_revenue"("department", "date");
