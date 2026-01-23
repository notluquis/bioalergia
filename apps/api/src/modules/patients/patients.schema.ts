import { z } from "zod";

/**
 * Schema for creating specific patient details
 */
export const createPatientSchema = z.object({
  // Person fields
  rut: z.string().regex(/^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/, "RUT inválido"),
  names: z.string().min(1, "Nombres son requeridos"),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  
  // Patient fields
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de nacimiento inválida (YYYY-MM-DD)"),
  bloodType: z.string().optional(),
  notes: z.string().optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
