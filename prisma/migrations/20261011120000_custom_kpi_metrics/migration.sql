CREATE TABLE "kpi_metrics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "daily_target" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL,
    "departments" TEXT[] NOT NULL,
    "starts_on" TEXT NOT NULL,
    "ends_on" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kpi_metrics_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "kpi_metrics_daily_target_check" CHECK ("daily_target" > 0),
    CONSTRAINT "kpi_metrics_weight_check" CHECK ("weight" > 0 AND "weight" <= 100),
    CONSTRAINT "kpi_metrics_dates_check" CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on")
);

CREATE TABLE "kpi_metric_entries" (
    "id" TEXT NOT NULL,
    "metric_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "kpi_metric_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "kpi_metric_entries_amount_check" CHECK ("amount" >= 0)
);

CREATE UNIQUE INDEX "kpi_metric_entries_metric_id_employee_id_date_key" ON "kpi_metric_entries"("metric_id", "employee_id", "date");
CREATE INDEX "kpi_metric_entries_employee_id_date_idx" ON "kpi_metric_entries"("employee_id", "date");
ALTER TABLE "kpi_metric_entries" ADD CONSTRAINT "kpi_metric_entries_metric_id_fkey" FOREIGN KEY ("metric_id") REFERENCES "kpi_metrics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kpi_metric_entries" ADD CONSTRAINT "kpi_metric_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
