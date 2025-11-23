-- AlterEnum
ALTER TYPE "CounterpartCategory" ADD VALUE 'OCCASIONAL';

-- AlterTable
ALTER TABLE "services" ALTER COLUMN "start_date" SET DEFAULT '1970-01-01';
