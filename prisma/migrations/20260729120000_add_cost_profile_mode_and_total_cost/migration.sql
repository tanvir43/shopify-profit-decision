-- AlterTable
CREATE TYPE "CostProfileMode" AS ENUM ('QUICK_START', 'DETAILED');

ALTER TABLE "CostProfile" ADD COLUMN "mode" "CostProfileMode" NOT NULL DEFAULT 'DETAILED';
ALTER TABLE "CostProfile" ADD COLUMN "totalCost" DECIMAL(19,6);
