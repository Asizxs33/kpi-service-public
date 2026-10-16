-- CreateTable
CREATE TABLE "employee_daily_debt" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_daily_debt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_daily_debt_date_idx" ON "employee_daily_debt"("date");

-- CreateIndex
CREATE UNIQUE INDEX "employee_daily_debt_employee_id_date_key" ON "employee_daily_debt"("employee_id", "date");

-- AddForeignKey
ALTER TABLE "employee_daily_debt" ADD CONSTRAINT "employee_daily_debt_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
