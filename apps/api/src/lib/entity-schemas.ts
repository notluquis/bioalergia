import { z } from "zod";
import { dateRegex, moneySchema } from "./financial-schemas";

// --- Service Schemas ---

const serviceFrequencyEnum = z.enum([
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "BIMONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
  "ONCE",
]);

const serviceOwnershipEnum = z.enum(["COMPANY", "OWNER", "MIXED", "THIRD_PARTY"]);
const serviceObligationEnum = z.enum(["SERVICE", "DEBT", "LOAN", "OTHER"]);
const serviceRecurrenceEnum = z.enum(["RECURRING", "ONE_OFF"]);
const serviceIndexationEnum = z.enum(["NONE", "UF"]);
const serviceLateFeeModeEnum = z.enum(["NONE", "FIXED", "PERCENTAGE"]);
const serviceEmissionModeEnum = z.enum(["FIXED_DAY", "DATE_RANGE", "SPECIFIC_DATE"]);

// Base object schema WITHOUT refinements (for .partial() compatibility in Zod v4)
const serviceBaseSchema = z.object({
  name: z.string().min(1).max(191),
  detail: z.string().max(255).optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  transactionCategoryId: z.coerce.number().int().positive().optional().nullable(),
  reminderDaysBefore: z.coerce.number().int().min(0).max(90).optional(),
  autoLinkTransactions: z.boolean().optional(),
  serviceType: z
    .enum(["BUSINESS", "PERSONAL", "SUPPLIER", "TAX", "UTILITY", "LEASE", "SOFTWARE", "OTHER"])
    .default("BUSINESS"),
  ownership: serviceOwnershipEnum.optional().default("COMPANY"),
  obligationType: serviceObligationEnum.optional().default("SERVICE"),
  recurrenceType: serviceRecurrenceEnum.optional().default("RECURRING"),
  frequency: serviceFrequencyEnum.default("MONTHLY"),
  defaultAmount: moneySchema,
  amountIndexation: serviceIndexationEnum.optional().default("NONE"),
  counterpartId: z.coerce.number().int().positive().optional().nullable(),
  counterpartAccountId: z.coerce.number().int().positive().optional().nullable(),
  accountReference: z.string().max(191).optional().nullable(),
  emissionMode: serviceEmissionModeEnum.optional().default("FIXED_DAY"),
  emissionDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  emissionStartDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  emissionEndDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  emissionExactDate: z.string().regex(dateRegex).optional().nullable(),
  dueDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  startDate: z.string().regex(dateRegex),
  monthsToGenerate: z.coerce.number().int().positive().max(60).optional(),
  lateFeeMode: serviceLateFeeModeEnum.optional().default("NONE"),
  lateFeeValue: z.coerce.number().min(0).optional().nullable(),
  lateFeeGraceDays: z.coerce.number().int().min(0).max(31).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

// Service refinement function (shared between create and update)
const serviceRefinement = (data: z.infer<typeof serviceBaseSchema>, ctx: z.RefinementCtx) => {
  if (data.emissionMode === "DATE_RANGE") {
    if (data.emissionStartDay == null || data.emissionEndDay == null) {
      ctx.addIssue({
        path: ["emissionStartDay"],
        code: "custom",
        message: "Debes indicar el rango de días de emisión",
      });
    } else if (data.emissionStartDay > data.emissionEndDay) {
      ctx.addIssue({
        path: ["emissionEndDay"],
        code: "custom",
        message: "El día final debe ser mayor o igual al inicial",
      });
    }
  }

  if (data.emissionMode === "SPECIFIC_DATE" && !data.emissionExactDate) {
    ctx.addIssue({
      path: ["emissionExactDate"],
      code: "custom",
      message: "Debes indicar la fecha exacta de emisión",
    });
  }

  if (data.emissionMode === "FIXED_DAY" && data.emissionDay == null) {
    ctx.addIssue({
      path: ["emissionDay"],
      code: "custom",
      message: "Indica el día de emisión",
    });
  }

  if (
    data.lateFeeMode !== "NONE" &&
    (data.lateFeeValue == null || Number.isNaN(data.lateFeeValue))
  ) {
    ctx.addIssue({
      path: ["lateFeeValue"],
      code: "custom",
      message: "Ingresa el monto o porcentaje del recargo",
    });
  }
};

// Create schema with refinements
export const serviceCreateSchema = serviceBaseSchema.superRefine(serviceRefinement);

// Update schema: partial of base object (no refinement issues in Zod v4)
// Refinements are applied after partial for update operations
export const serviceUpdateSchema = serviceBaseSchema.partial();

// --- Counterpart Schemas ---

export const counterpartPayloadSchema = z.object({
  identificationNumber: z.string().trim().min(1).max(50),
  bankAccountHolder: z.string().min(1).max(255),
  category: z
    .enum(["SUPPLIER", "CLIENT", "EMPLOYEE", "PARTNER", "LENDER", "PERSONAL_EXPENSE", "OTHER"])
    .optional()
    .default("SUPPLIER"),
  notes: z.string().max(500).optional().nullable(),
});

const counterpartAccountBaseSchema = z.object({
  accountIdentifier: z.string().trim().min(1).max(191).optional(),
  accountNumber: z.string().trim().min(1).max(191).optional(),
  bankName: z.string().max(191).optional().nullable(),
  accountType: z.string().max(64).optional().nullable(),
  holder: z.string().max(191).optional().nullable(),
  concept: z.string().max(191).optional().nullable(),
  metadata: z
    .object({
      bankAccountNumber: z.string().max(191).optional().nullable(),
      withdrawId: z.string().max(191).optional().nullable(),
    })
    .optional()
    .nullable(),
});

export const counterpartAccountPayloadSchema = counterpartAccountBaseSchema.refine(
  (data) => Boolean(data.accountIdentifier || data.accountNumber),
  {
    message: "Ingresa un identificador de cuenta",
    path: ["accountIdentifier"],
  },
);

export const counterpartAccountUpdateSchema = counterpartAccountBaseSchema.partial().extend({
  concept: z.string().max(191).optional().nullable(),
  metadata: counterpartAccountBaseSchema.shape.metadata.optional(),
});

export const counterpartBulkAssignRutSchema = z.object({
  accountNumbers: z.array(z.string().trim().min(1).max(191)).min(1).max(500),
  bankAccountHolder: z.string().min(1).max(255).optional(),
  rut: z.string().trim().min(1).max(50),
});

// --- Role Schemas ---

export const roleCreateSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(255).optional().nullable(),
  isSystem: z.boolean().optional().default(false),
});

export const roleUpdateSchema = roleCreateSchema.partial();

export const roleAssignPermissionsSchema = z.object({
  permissionIds: z.array(z.coerce.number().int().positive()),
});
