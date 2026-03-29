-- Add connection_type to attendance_marks for device network info (wifi/cellular/etc.)
ALTER TABLE "attendance_marks" ADD COLUMN "connection_type" VARCHAR(50);
