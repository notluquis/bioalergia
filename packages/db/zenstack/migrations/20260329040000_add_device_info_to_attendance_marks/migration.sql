ALTER TABLE "attendance_marks"
  ADD COLUMN "downlink_mbps" DOUBLE PRECISION,
  ADD COLUMN "is_mobile" BOOLEAN,
  ADD COLUMN "client_timezone" VARCHAR(100),
  ADD COLUMN "device_ram" INTEGER,
  ADD COLUMN "cpu_cores" INTEGER,
  ADD COLUMN "screen_resolution" VARCHAR(30),
  ADD COLUMN "device_pixel_ratio" DOUBLE PRECISION;
