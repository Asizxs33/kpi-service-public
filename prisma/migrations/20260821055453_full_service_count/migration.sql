/*
  Warnings:

  - You are about to drop the column `full_service` on the `log_entries` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "log_entries" DROP COLUMN "full_service",
ADD COLUMN     "full_service_count" INTEGER;
