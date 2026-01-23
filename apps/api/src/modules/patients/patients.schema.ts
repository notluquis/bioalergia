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

export const createConsultationSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)"),
  reason: z.string().min(1, "Motivo de consulta es requerido"),
  diagnosis: z.string().optional(),
  treatment: z.string().optional(),
  notes: z.string().optional(),
  eventId: z.number().int().optional(),
});

export const createBudgetItemSchema = z.object({
  description: z.string().min(1, "Descripción del ítem es requerida"),
  quantity: z.number().min(1, "Cantidad debe ser al menos 1"),
  unitPrice: z.number().min(0, "Precio unitario debe ser mayor o igual a 0"),
});

export const createBudgetSchema = z.object({
  title: z.string().min(1, "Título del presupuesto es requerido"),
  discount: z.number().min(0).default(0),
  notes: z.string().optional(),
  items: z.array(createBudgetItemSchema).min(1, "Al menos un ítem es requerido"),
});

export const createPaymentSchema = z.object({
  budgetId: z.number().int().optional(),
  amount: z.number().positive("Monto debe ser mayor a 0"),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)"),
  paymentMethod: z.enum(["Transferencia", "Efectivo", "Tarjeta", "Otro"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export const createAttachmentSchema = z.object({
  name: z.string().min(1, "Nombre del archivo es requerido"),
  type: z.enum(["CONSENT", "EXAM", "RECIPE", "OTHER"]),
  driveFileId: z.string(),
  mimeType: z.string().optional(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;
