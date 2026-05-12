-- Create AttendanceMarkType enum
CREATE TYPE "AttendanceMarkType" AS ENUM ('CLOCK_IN', 'CLOCK_OUT');

-- Create attendance_marks table
CREATE TABLE "attendance_marks" (
    "id"               BIGSERIAL PRIMARY KEY,
    "employee_id"      INTEGER NOT NULL,
    "marked_at"        TIMESTAMPTZ NOT NULL,
    "type"             "AttendanceMarkType" NOT NULL,
    "latitude"         DOUBLE PRECISION,
    "longitude"        DOUBLE PRECISION,
    "accuracy_meters"  DOUBLE PRECISION,
    "ip_address"       VARCHAR(45),
    "is_office_network" BOOLEAN NOT NULL DEFAULT false,
    "user_agent"       VARCHAR(512),
    "notes"            TEXT,
    "created_by_user_id" INTEGER,
    CONSTRAINT "attendance_marks_employee_id_fkey"
        FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE,
    CONSTRAINT "attendance_marks_created_by_user_id_fkey"
        FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "attendance_marks_employee_id_marked_at_idx"
    ON "attendance_marks"("employee_id", "marked_at");

-- Create office_networks table
CREATE TABLE "office_networks" (
    "id"        SERIAL PRIMARY KEY,
    "name"      TEXT NOT NULL,
    "cidr"      VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true
);
