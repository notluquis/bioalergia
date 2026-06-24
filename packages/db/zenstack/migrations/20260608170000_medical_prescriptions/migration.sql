CREATE TABLE "medical_prescriptions" (
    "id" TEXT NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "patient_name" TEXT NOT NULL,
    "patient_rut" TEXT,
    "date" DATE NOT NULL,
    "diagnosis" TEXT,
    "medications" JSONB NOT NULL,
    "notes" TEXT,
    "doctor_name" TEXT,
    "doctor_specialty" TEXT,
    "doctor_rut" TEXT,
    "doctor_email" TEXT,
    "doctor_address" TEXT,
    "issued_by" INTEGER NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "drive_file_id" TEXT NOT NULL,
    "pdf_hash" TEXT NOT NULL,
    "metadata" JSONB,
    CONSTRAINT "medical_prescriptions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "medical_prescriptions" ADD CONSTRAINT "medical_prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "medical_prescriptions" ADD CONSTRAINT "medical_prescriptions_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "medical_prescriptions_patient_id_issued_at_idx" ON "medical_prescriptions"("patient_id", "issued_at");
CREATE INDEX "medical_prescriptions_issued_at_idx" ON "medical_prescriptions"("issued_at");
