-- CreateTable
CREATE TABLE "medical_certificates" (
    "id" TEXT NOT NULL,
    "patient_name" TEXT NOT NULL,
    "patient_rut" TEXT NOT NULL,
    "birth_date" DATE NOT NULL,
    "address" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "symptoms" TEXT,
    "rest_days" INTEGER,
    "rest_start_date" DATE,
    "rest_end_date" DATE,
    "purpose" TEXT NOT NULL,
    "purpose_detail" TEXT,
    "issued_by" INTEGER NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "drive_file_id" TEXT NOT NULL,
    "pdf_hash" TEXT NOT NULL,
    "metadata" JSONB,
    CONSTRAINT "medical_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "medical_certificates_patient_rut_idx" ON "medical_certificates" ("patient_rut");

-- CreateIndex
CREATE INDEX "medical_certificates_issued_at_idx" ON "medical_certificates" ("issued_at");

-- AddForeignKey
ALTER TABLE "medical_certificates"
ADD CONSTRAINT "medical_certificates_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;