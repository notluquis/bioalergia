import { z } from "zod";

// Enums
export const ServiceTypeSchema = z.enum([
  "BUSINESS",
  "LEASE",
  "OTHER",
  "PERSONAL",
  "SOFTWARE",
  "SUPPLIER",
  "TAX",
  "UTILITY",
]);

export const ServiceFrequencySchema = z.enum([
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "BIMONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
  "ONCE",
]);

export const ServiceOwnershipSchema = z.enum(["COMPANY", "MIXED", "OWNER", "THIRD_PARTY"]);

export const ServiceObligationTypeSchema = z.enum(["DEBT", "LOAN", "OTHER", "SERVICE"]);

export const ServiceRecurrenceTypeSchema = z.enum(["ONE_OFF", "RECURRING"]);

export const EmissionModeSchema = z.enum(["FIXED_DAY", "DATE_RANGE", "SPECIFIC_DATE"]);

export const LateFeeMode = z.enum(["NONE", "FIXED", "PERCENTAGE"]);

export const AmountIndexationSchema = z.enum(["NONE", "UF"]);

export const ScheduleStatusSchema = z.enum(["PENDING", "PAID", "PARTIAL", "SKIPPED"]);

// Service Form Schema (Create/Edit)
export const ServiceFormSchema = z
  .object({
    // Basic Info
    name: z
      .string()
      .min(1, "El nombre es requerido")
      .max(255, "Nombre demasiado largo (máx 255 caracteres)"),
    detail: z.string().max(500, "Detalle demasiado largo (máx 500 caracteres)").optional(),
    category: z.string().max(100).optional(),
    notes: z.string().max(2000, "Notas demasiado largas (máx 2000 caracteres)").optional(),

    // Classification
    serviceType: ServiceTypeSchema,
    ownership: ServiceOwnershipSchema,
    obligationType: ServiceObligationTypeSchema,
    recurrenceType: ServiceRecurrenceTypeSchema,

    // Counterpart
    counterpartId: z.number().int().positive().nullable(),
    counterpartAccountId: z.number().int().positive().nullable(),
    accountReference: z.string().max(100).optional(),

    // Scheduling
    frequency: ServiceFrequencySchema,
    startDate: z.date({ message: "Fecha de inicio requerida" }),
    dueDay: z.number().int().min(1, "Día debe ser entre 1 y 31").max(31).nullable(),
    monthsToGenerate: z
      .number()
      .int()
      .min(1, "Debe generar al menos 1 mes")
      .max(60, "Máximo 60 meses"),

    // Emission
    emissionMode: EmissionModeSchema,
    emissionDay: z.number().int().min(1).max(31).nullable(),
    emissionStartDay: z.number().int().min(1).max(31).nullable(),
    emissionEndDay: z.number().int().min(1).max(31).nullable(),
    emissionExactDate: z.date().nullable(),

    // Financial
    defaultAmount: z.number().min(0, "El monto debe ser mayor o igual a 0"),
    amountIndexation: AmountIndexationSchema,
    lateFeeMode: LateFeeMode,
    lateFeeValue: z.number().min(0).nullable(),
    lateFeeGraceDays: z.number().int().min(0).max(365).nullable(),
  })
  .refine(
    (data) => {
      // Late fee value required if mode is not NONE
      if (data.lateFeeMode !== "NONE" && data.lateFeeValue === null) {
        return false;
      }
      return true;
    },
    {
      message: "Valor de recargo requerido cuando el modo no es NONE",
      path: ["lateFeeValue"],
    },
  )
  .refine(
    (data) => {
      // Emission day required for FIXED_DAY mode
      if (data.emissionMode === "FIXED_DAY" && data.emissionDay === null) {
        return false;
      }
      return true;
    },
    {
      message: "Día de emisión requerido para modo día fijo",
      path: ["emissionDay"],
    },
  )
  .refine(
    (data) => {
      // Emission range required for DATE_RANGE mode
      if (
        data.emissionMode === "DATE_RANGE" &&
        (data.emissionStartDay === null || data.emissionEndDay === null)
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Rango de emisión requerido para modo rango de fechas",
      path: ["emissionStartDay"],
    },
  )
  .refine(
    (data) => {
      // Emission exact date required for SPECIFIC_DATE mode
      if (data.emissionMode === "SPECIFIC_DATE" && data.emissionExactDate === null) {
        return false;
      }
      return true;
    },
    {
      message: "Fecha exacta requerida para modo fecha específica",
      path: ["emissionExactDate"],
    },
  )
  .refine(
    (data) => {
      // Validate emission range order
      if (
        data.emissionMode === "DATE_RANGE" &&
        data.emissionStartDay !== null &&
        data.emissionEndDay !== null
      ) {
        return data.emissionStartDay <= data.emissionEndDay;
      }
      return true;
    },
    {
      message: "Día de inicio debe ser menor o igual al día final",
      path: ["emissionEndDay"],
    },
  );

// Payment Form Schema
export const PaymentFormSchema = z.object({
  transactionId: z
    .string()
    .min(1, "ID de transacción requerido")
    .transform((val) => Number(val))
    .pipe(z.number().int().positive("ID de transacción debe ser un número válido")),
  paidAmount: z.number().positive("Monto pagado debe ser mayor a 0"),
  paidDate: z.date({ message: "Fecha de pago requerida" }),
  note: z.string().max(500, "Nota demasiado larga (máx 500 caracteres)").optional(),
});

// Schedule Edit Schema
export const ScheduleEditSchema = z.object({
  dueDate: z.date({ message: "Fecha de vencimiento requerida" }),
  expectedAmount: z.number().positive("Monto esperado debe ser mayor a 0"),
  note: z.string().max(500, "Nota demasiado larga (máx 500 caracteres)").optional(),
});

// Skip Schedule Schema
export const SkipScheduleSchema = z.object({
  reason: z
    .string()
    .min(1, "Motivo requerido")
    .max(500, "Motivo demasiado largo (máx 500 caracteres)"),
});

// Regenerate Service Payload Schema
export const RegenerateServiceSchema = z.object({
  months: z.number().int().min(1).max(60).optional(),
  startDate: z.date().optional(),
  defaultAmount: z.number().min(0).optional(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  frequency: ServiceFrequencySchema.optional(),
  emissionDay: z.number().int().min(1).max(31).nullable().optional(),
});

// Type exports
export type ServiceFormValues = z.infer<typeof ServiceFormSchema>;
export type PaymentFormValues = z.infer<typeof PaymentFormSchema>;
export type ScheduleEditValues = z.infer<typeof ScheduleEditSchema>;
export type SkipScheduleValues = z.infer<typeof SkipScheduleSchema>;
export type RegenerateServiceValues = z.infer<typeof RegenerateServiceSchema>;
