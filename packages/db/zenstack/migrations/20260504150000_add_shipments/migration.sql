-- CreateTable
CREATE TABLE "shipments" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "ot_number" TEXT NOT NULL,
    "service_type_code" TEXT NOT NULL,
    "service_description" TEXT NOT NULL,
    "cash_on_delivery" DECIMAL(12,2) NOT NULL,
    "declared_value" DECIMAL(12,2) NOT NULL,
    "weight" DECIMAL(8,2) NOT NULL,
    "height" DECIMAL(8,2) NOT NULL,
    "width" DECIMAL(8,2) NOT NULL,
    "length" DECIMAL(8,2) NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "recipient_phone" TEXT NOT NULL,
    "recipient_email" TEXT,
    "commercial_office_id" TEXT NOT NULL,
    "commercial_office_name" TEXT NOT NULL,
    "coverage_code" TEXT NOT NULL,
    "content_description" TEXT NOT NULL,
    "label_base64" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipments_ot_number_key" ON "shipments"("ot_number");

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
