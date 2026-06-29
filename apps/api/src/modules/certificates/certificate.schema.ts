import { z } from "zod";

/**
 * Schema for medical certificate generation request
 */
export const medicalCertificateSchema = z.object({
  // Patient information
  patientName: z.string().min(1, "Nombre del paciente es requerido"),
  rut: z.string().regex(/^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/, "RUT inválido"),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de nacimiento inválida"),
  address: z.string().min(1, "Domicilio es requerido"),

  // Certificate date
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),

  // Diagnosis / reason
  diagnosis: z.string().min(1, "Diagnóstico es requerido"),
  symptoms: z.string().optional(),

  // Rest period (optional)
  restDays: z.number().int().min(0).optional(),
  restStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  restEndDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),

  // Purpose
  purpose: z.enum(["trabajo", "estudio", "otro"]).default("trabajo"),
  purposeDetail: z.string().optional(),

  // Doctor information (can be overridden or use defaults)
  doctorName: z.string().optional(),
  doctorSpecialty: z.string().optional(),
  doctorRut: z.string().optional(),
  doctorEmail: z.email().optional(),
  doctorAddress: z.string().optional(),
});

export type MedicalCertificateInput = z.infer<typeof medicalCertificateSchema>;

export const prescriptionMedicationSchema = z.object({
  name: z.string().min(1, "Medicamento es requerido").max(180),
  dosage: z.string().max(160).optional(),
  frequency: z.string().max(160).optional(),
  duration: z.string().max(160).optional(),
  instructions: z.string().max(300).optional(),
});

export const prescriptionDiagnosisSchema = z.object({
  category: z.string().max(120).optional(),
  cie10Code: z.string().max(40).optional(),
  code: z.string().max(40).optional(),
  custom: z.boolean().optional(),
  id: z.string().min(1).max(240),
  label: z.string().min(1).max(240),
  release: z.string().max(160).optional(),
  source: z.enum(["CIE-11", "CUSTOM"]),
  sourceLabel: z.string().max(160).optional(),
  uri: z.string().max(300).optional(),
});

export const medicalPrescriptionSchema = z.object({
  patientId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  diagnosis: z.string().max(500).optional(),
  diagnoses: z.array(prescriptionDiagnosisSchema).max(8).optional(),
  medications: z.array(prescriptionMedicationSchema).min(1).max(12),
  notes: z.string().max(1000).optional(),
  // Modificar = re-emitir: si viene, la receta original se anula al crear esta.
  supersedesId: z.string().optional(),
  doctorName: z.string().optional(),
  doctorSpecialty: z.string().optional(),
  doctorRut: z.string().optional(),
  doctorEmail: z.email().optional(),
  doctorAddress: z.string().optional(),
});

export type MedicalPrescriptionInput = z.infer<typeof medicalPrescriptionSchema>;
export type PrescriptionMedicationInput = z.infer<typeof prescriptionMedicationSchema>;
export type PrescriptionDiagnosisInput = z.infer<typeof prescriptionDiagnosisSchema>;

// JSON-safe: sólo strings reales (sin claves `undefined`). Los campos opcionales
// de Zod (`.optional()`) llegan como `undefined` cuando el médico no los
// completa; ZenStack valida los `Json` y RECHAZA `undefined` (sólo `null` es
// JSON válido). Persistimos una forma normalizada y tipada, no el objeto crudo.
export type StoredPrescriptionMedication = {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
};

export function toStoredMedications(
  medications: PrescriptionMedicationInput[]
): StoredPrescriptionMedication[] {
  return medications.map((m) => {
    const stored: StoredPrescriptionMedication = { name: m.name };
    if (m.dosage) stored.dosage = m.dosage;
    if (m.frequency) stored.frequency = m.frequency;
    if (m.duration) stored.duration = m.duration;
    if (m.instructions) stored.instructions = m.instructions;
    return stored;
  });
}

export type StoredPrescriptionDiagnosis = {
  id: string;
  label: string;
  source: "CIE-11" | "CUSTOM";
  code?: string;
  cie10Code?: string;
  category?: string;
  release?: string;
  sourceLabel?: string;
  uri?: string;
  custom?: boolean;
};

export function toStoredDiagnoses(
  diagnoses: PrescriptionDiagnosisInput[]
): StoredPrescriptionDiagnosis[] {
  return diagnoses.map((d) => {
    const stored: StoredPrescriptionDiagnosis = { id: d.id, label: d.label, source: d.source };
    if (d.code) stored.code = d.code;
    if (d.cie10Code) stored.cie10Code = d.cie10Code;
    if (d.category) stored.category = d.category;
    if (d.release) stored.release = d.release;
    if (d.sourceLabel) stored.sourceLabel = d.sourceLabel;
    if (d.uri) stored.uri = d.uri;
    if (d.custom !== undefined) stored.custom = d.custom;
    return stored;
  });
}

/**
 * Default doctor information (loaded from env or config)
 */
export const defaultDoctorInfo = {
  name: "Dr. José Manuel Martínez Martínez",
  specialty: "Especialista en Alergología e Inmunología Clínica",
  title: "Director Médico Bioalergia",
  rut: "11.896.644-9",
  email: "contacto@bioalergia.cl",
  address: "Avenida Arturo Prat 199, Oficina A603, Concepción",
};
