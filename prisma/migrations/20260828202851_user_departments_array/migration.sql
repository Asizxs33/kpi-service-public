-- AlterTable: add new departments array column, backfill from old
-- department column, then drop the old column.
ALTER TABLE "users" ADD COLUMN "departments" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "users"
SET "departments" = CASE WHEN "department" IS NOT NULL THEN ARRAY["department"] ELSE ARRAY[]::TEXT[] END;

ALTER TABLE "users" DROP COLUMN "department";
