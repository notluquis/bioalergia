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

/**
 * Default doctor information (loaded from env or config)
 */
export const defaultDoctorInfo = {
  name: "Dr. José Manuel Martínez Martínez",
  specialty: "Especialista en Alergología e Inmunología Clínica",
  title: "Director Médico Bioalergia",
  rut: "11.896.644-9",
  email: "contacto@bioalergia.cl",
  address: "Avenida Prat 199, Oficina A603, Concepción",
};
