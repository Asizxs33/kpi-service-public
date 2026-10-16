-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER');

-- CreateEnum
CREATE TYPE "LogType" AS ENUM ('UPSELL', 'COMPLAINT', 'DISCIPLINE', 'REFERRAL');

-- CreateEnum
CREATE TYPE "ComplaintKind" AS ENUM ('REVIEW', 'COMPLAINT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MANAGER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "position" TEXT NOT NULL DEFAULT 'Продавец-консультант',
    "hire_date" TEXT,
    "sales_target" INTEGER NOT NULL DEFAULT 0,
    "min_reviews" INTEGER NOT NULL DEFAULT 0,
    "min_referrals" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_entries" (
    "id" TEXT NOT NULL,
    "type" "LogType" NOT NULL,
    "date" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "notes" TEXT,
    "source" TEXT,
    "sales_amount" INTEGER,
    "customers_served" INTEGER,
    "successful_upsells" INTEGER,
    "seven_steps" BOOLEAN,
    "kind" "ComplaintKind",
    "violation_type" TEXT,
    "fine" INTEGER,
    "count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "base" INTEGER NOT NULL DEFAULT 35,
    "discipline" INTEGER NOT NULL DEFAULT 15,
    "personal" INTEGER NOT NULL DEFAULT 30,
    "upsell" INTEGER NOT NULL DEFAULT 10,
    "quality" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "log_entries_employee_id_idx" ON "log_entries"("employee_id");

-- CreateIndex
CREATE INDEX "log_entries_type_idx" ON "log_entries"("type");

-- CreateIndex
CREATE INDEX "log_entries_date_idx" ON "log_entries"("date");

-- CreateIndex
CREATE UNIQUE INDEX "log_entries_employee_id_date_source_type_key" ON "log_entries"("employee_id", "date", "source", "type");

-- AddForeignKey
ALTER TABLE "log_entries" ADD CONSTRAINT "log_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
