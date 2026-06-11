// Genera recetas de muestra (SIMPLE + RETENIDA) para validación PDF/UA + PDF/A
// en CI (veraPDF). Usa data fixture con campos largos para ejercitar overflow/
// wrap. NO toca DB - generateMedicalPrescriptionPdf es puro (fixture in -> bytes).
//
// Uso: node apps/api/scripts/gen-sample-receta.mjs [outDir]   (default /tmp)
import { mkdirSync, writeFileSync } from "node:fs";
import {
  generateMedicalPrescriptionPdf,
  generateQRCode,
} from "../src/modules/certificates/certificate.service.ts";

const outDir = process.argv[2] ?? "/tmp";
mkdirSync(outDir, { recursive: true });

const qrCodeBuffer = await generateQRCode("ABCD-1234-EFGH-5678");

const base = {
  patientId: 1,
  date: "2026-06-10",
  diagnosis:
    "8A8Z - Trastornos de cefalea, sin especificación; 4A8Z - Afecciones alérgicas o de hipersensibilidad, sin especificación; CA08.0 - Rinitis alérgica persistente moderada-severa con sensibilización a ácaros del polvo doméstico",
  medications: [
    {
      name: "Levocetirizina diclorhidrato 5 mg comprimidos recubiertos con película",
      dosage: "1 comprimido",
      frequency: "cada 24 horas",
      duration: "30 días",
      instructions: "Tomar por la noche, alejado de las comidas",
    },
    {
      name: "Furoato de mometasona spray nasal acuoso 50 mcg/dosis",
      dosage: "2 aplicaciones en cada fosa nasal",
      frequency: "cada 24 horas",
      duration: "uso continuo",
    },
  ],
  notes:
    "Control en 1 mes. Evitar exposición a alérgenos conocidos. Lavado nasal con suero fisiológico.",
  doctorName: "Dra. María José Ejemplo Apellido",
  doctorSpecialty: "Inmunología y alergología",
  doctorRut: "12.345.678-9",
  doctorLicense: "123456",
  patient: { name: "Nombre Largo De Paciente De Prueba González", rut: "20.123.456-7" },
  patientSex: "F",
  patientBirthDate: "1990-05-15",
  patientAge: 36,
  folio: "R-2026-000123",
  verificationCode: "ABCD-1234-EFGH-5678",
  qrCodeBuffer,
};

for (const prescriptionType of ["SIMPLE", "RETENIDA"]) {
  const bytes = await generateMedicalPrescriptionPdf({ ...base, prescriptionType, mode: "full" });
  const out = `${outDir}/receta_${prescriptionType}.pdf`;
  writeFileSync(out, bytes);
  console.log(`wrote ${out} (${bytes.length} bytes)`);
}
