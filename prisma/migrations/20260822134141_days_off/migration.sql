-- CreateTable
CREATE TABLE "days_off" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "days_off_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "days_off_employee_id_idx" ON "days_off"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "days_off_employee_id_date_key" ON "days_off"("employee_id", "date");

-- AddForeignKey
ALTER TABLE "days_off" ADD CONSTRAINT "days_off_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
