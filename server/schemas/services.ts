/**
 * Services schemas
 */
import { z } from "zod";

import { dateRegex, moneySchema } from "./shared.js";

// Service enums
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

export const serviceCreateSchema = z
  .object({
    name: z.string().min(1).max(191),
    detail: z.string().max(255).optional().nullable(),
    category: z.string().max(120).optional().nullable(),
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
  })
  .superRefine((data, ctx) => {
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

    if (data.lateFeeMode !== "NONE" && (data.lateFeeValue == null || Number.isNaN(data.lateFeeValue))) {
      ctx.addIssue({
        path: ["lateFeeValue"],
        code: "custom",
        message: "Ingresa el monto o porcentaje del recargo",
      });
    }
  });

export const serviceRegenerateSchema = z
  .object({
    months: z.coerce.number().int().positive().max(60).optional(),
    startDate: z.string().regex(dateRegex).optional(),
    defaultAmount: moneySchema.optional(),
    dueDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
    frequency: serviceFrequencyEnum.optional(),
    emissionDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  })
  .optional()
  .default({});

export const servicePaymentSchema = z.object({
  transactionId: z.coerce.number().int().positive(),
  paidAmount: moneySchema,
  paidDate: z.string().regex(dateRegex),
  note: z.string().max(255).optional().nullable(),
});
