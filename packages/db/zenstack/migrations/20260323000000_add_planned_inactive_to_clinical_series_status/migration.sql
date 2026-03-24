-- Add PLANNED and INACTIVE to ClinicalSeriesStatus enum
ALTER TYPE "ClinicalSeriesStatus" ADD VALUE IF NOT EXISTS 'PLANNED';
ALTER TYPE "ClinicalSeriesStatus" ADD VALUE IF NOT EXISTS 'INACTIVE';
