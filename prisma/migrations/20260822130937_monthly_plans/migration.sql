-- CreateTable
CREATE TABLE "monthly_plans" (
    "id" TEXT NOT NULL,
    "month_key" TEXT NOT NULL,
    "employee_id" TEXT,
    "department" TEXT,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_plans_month_key_idx" ON "monthly_plans"("month_key");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_plans_month_key_employee_id_key" ON "monthly_plans"("month_key", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_plans_month_key_department_key" ON "monthly_plans"("month_key", "department");

-- AddForeignKey
ALTER TABLE "monthly_plans" ADD CONSTRAINT "monthly_plans_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
