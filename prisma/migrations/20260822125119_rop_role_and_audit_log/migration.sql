-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ROP';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "department" TEXT;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "log_entry_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "user_id" TEXT,
    "user_name" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_log_entry_id_idx" ON "audit_logs"("log_entry_id");
