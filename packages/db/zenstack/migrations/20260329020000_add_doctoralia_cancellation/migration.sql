-- Add CANCELLATION value to DoctoraliaEmailEventType enum

ALTER TYPE public."DoctoraliaEmailEventType" ADD VALUE IF NOT EXISTS 'CANCELLATION';
