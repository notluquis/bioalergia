import { z } from "zod";

const colorRegex = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const httpsUrlSchema = z
  .string()
  .trim()
  .url({ message: "Debe ser una URL válida" })
  .refine((value) => value.startsWith("https://"), {
    message: "Debe comenzar con https://",
  });

const optionalHttpsUrl = z.union([z.literal(""), httpsUrlSchema]);

const logoUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => value.startsWith("https://") || value.startsWith("/uploads/"),
    { message: "Debe comenzar con https:// o /uploads/" }
  );

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

export const settingsSchema = z.object({
  orgName: z.string().min(1).max(120),
  tagline: z.string().max(200).optional().default(""),
  primaryColor: z.string().regex(colorRegex, "Debe ser un color HEX"),
  secondaryColor: z.string().regex(colorRegex, "Debe ser un color HEX"),
  logoUrl: logoUrlSchema,
  dbDisplayHost: z.string().min(1).max(191),
  dbDisplayName: z.string().min(1).max(191),
  dbConsoleUrl: optionalHttpsUrl.default(""),
  cpanelUrl: optionalHttpsUrl.default(""),
  orgAddress: z.string().max(255).optional().default(""),
  orgPhone: z.string().max(60).optional().default(""),
  primaryCurrency: z.string().trim().min(2).max(8).optional().default("CLP"),
  supportEmail: z.string().email(),
});

export const transactionsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(2000).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  description: z.string().optional(),
  origin: z.string().optional(),
  destination: z.string().optional(),
  sourceId: z.string().optional(),
  direction: z.enum(["IN", "OUT", "NEUTRO"]).optional(),
  file: z.string().optional(),
  includeAmounts: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(500).optional(),
});

export const statsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const participantLeaderboardQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  mode: z.enum(["combined", "incoming", "outgoing"]).optional(),
});

export const counterpartPayloadSchema = z.object({
  rut: z.string().trim().max(64).optional().nullable(),
  name: z.string().min(1).max(191),
  personType: z.enum(["PERSON", "COMPANY", "OTHER"]).default("OTHER"),
  category: z.enum(["SUPPLIER", "PATIENT", "EMPLOYEE", "PARTNER", "RELATED", "OTHER"]).optional().default("SUPPLIER"),
  email: z.string().email().optional().nullable(),
  employeeEmail: z.string().email().optional().nullable(),
  employeeId: z.coerce.number().int().positive().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const counterpartAccountPayloadSchema = z.object({
  accountIdentifier: z.string().trim().min(1).max(191),
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

export const counterpartAccountUpdateSchema = counterpartAccountPayloadSchema.partial().extend({
  concept: z.string().max(191).optional().nullable(),
  metadata: counterpartAccountPayloadSchema.shape.metadata.optional(),
});

export const balancesQuerySchema = z.object({
  from: z.string().regex(dateRegex).optional(),
  to: z.string().regex(dateRegex).optional(),
});

export const balanceUpsertSchema = z.object({
  date: z.string().regex(dateRegex, "Fecha inválida"),
  balance: z.coerce.number(),
  note: z.string().max(255).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const employeeSchema = z.object({
  full_name: z.string().min(1).max(191),
  role: z.string().min(1).max(120),
  email: z.string().email().nullable().optional(),
  rut: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .nullable()
    .optional(),
  bank_name: z.string().trim().max(120).nullable().optional(),
  bank_account_type: z.string().trim().max(32).nullable().optional(),
  bank_account_number: z.string().trim().max(64).nullable().optional(),
  salary_type: z.enum(["hourly", "fixed"]).default("hourly"),
  hourly_rate: z.coerce.number().min(0).optional(),
  fixed_salary: z.coerce.number().min(0).nullable().optional(),
  overtime_rate: z.coerce.number().min(0).nullable().optional(),
  retention_rate: z.coerce.number().min(0).max(1),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
});

export const employeeUpdateSchema = employeeSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const timesheetPayloadSchema = z.object({
  employee_id: z.coerce.number().int().positive(),
  work_date: z.string().regex(dateRegex),
  start_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  worked_minutes: z.coerce.number().int().min(0),
  overtime_minutes: z.coerce.number().int().min(0).default(0),
  extra_amount: z.coerce.number().min(0).default(0),
  comment: z.string().max(255).nullable().optional(),
});

export const timesheetUpdateSchema = timesheetPayloadSchema
  .omit({ employee_id: true, work_date: true })
  .partial();

export const timesheetBulkSchema = z.object({
  employee_id: z.coerce.number().int().positive(),
  entries: z
    .array(
      z.object({
        work_date: z.string().regex(dateRegex),
        start_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
        end_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
        overtime_minutes: z.coerce.number().int().min(0).default(0),
        extra_amount: z.coerce.number().min(0).default(0),
        comment: z.string().max(255).nullable().optional(),
      })
    )
    .max(200),
  remove_ids: z.array(z.coerce.number().int().positive()).optional(),
});

export const inventoryCategorySchema = z.object({
  name: z.string().min(1).max(255),
});

export const inventoryItemSchema = z.object({
  category_id: z.coerce.number().int().positive().nullable(),
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  current_stock: z.coerce.number().int().default(0),
});

export const inventoryItemUpdateSchema = inventoryItemSchema.partial();

export const inventoryMovementSchema = z.object({
  item_id: z.coerce.number().int().positive(),
  quantity_change: z.coerce.number().int(),
  reason: z.string().min(1).max(255),
});

const moneySchema = z.coerce.number().min(0);

export const loanCreateSchema = z.object({
  title: z.string().min(1).max(191),
  borrowerName: z.string().min(1).max(191),
  borrowerType: z.enum(["PERSON", "COMPANY"]).default("PERSON"),
  principalAmount: moneySchema,
  interestRate: z.coerce.number().min(0),
  interestType: z.enum(["SIMPLE", "COMPOUND"]).default("SIMPLE"),
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]),
  totalInstallments: z.coerce.number().int().positive().max(360),
  startDate: z.string().regex(dateRegex),
  notes: z.string().max(500).optional().nullable(),
  generateSchedule: z.boolean().optional().default(true),
});

export const loanScheduleRegenerateSchema = z.object({
  totalInstallments: z.coerce.number().int().positive().max(360).optional(),
  startDate: z.string().regex(dateRegex).optional(),
  interestRate: z.coerce.number().min(0).optional(),
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]).optional(),
});

export const loanPaymentSchema = z.object({
  transactionId: z.coerce.number().int().positive(),
  paidAmount: moneySchema,
  paidDate: z.string().regex(dateRegex),
});

export const serviceCreateSchema = z
  .object({
    name: z.string().min(1).max(191),
    detail: z.string().max(255).optional().nullable(),
    category: z.string().max(120).optional().nullable(),
    serviceType: z.enum(["BUSINESS", "PERSONAL", "SUPPLIER", "TAX", "UTILITY", "LEASE", "SOFTWARE", "OTHER"]).default("BUSINESS"),
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

export const serviceRegenerateSchema = z.object({
  months: z.coerce.number().int().positive().max(60).optional(),
  startDate: z.string().regex(dateRegex).optional(),
  defaultAmount: moneySchema.optional(),
  dueDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  frequency: serviceFrequencyEnum.optional(),
  emissionDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
}).optional().default({});

export const servicePaymentSchema = z.object({
  transactionId: z.coerce.number().int().positive(),
  paidAmount: moneySchema,
  paidDate: z.string().regex(dateRegex),
  note: z.string().max(255).optional().nullable(),
});
