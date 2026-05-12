import { oc } from "@orpc/contract";
import { z } from "zod";

export const serviceIdSchema = z.object({
  id: z.string().min(1),
});

export const scheduleIdSchema = z.object({
  id: z.number().int().positive(),
});

export const serviceCreateSchema = z.object({
  accountReference: z.string().nullable().optional(),
  amountIndexation: z.enum(["NONE", "UF"]).optional(),
  autoLinkTransactions: z.boolean().optional(),
  category: z.string().nullable().optional(),
  counterpartAccountId: z.number().int().nullable().optional(),
  counterpartId: z.number().int().nullable().optional(),
  defaultAmount: z.number().min(0),
  detail: z.string().nullable().optional(),
  dueDay: z.number().int().nullable().optional(),
  emissionDay: z.number().int().nullable().optional(),
  emissionEndDay: z.number().int().nullable().optional(),
  emissionExactDate: z.coerce.date().nullable().optional(),
  emissionMode: z.enum(["DATE_RANGE", "FIXED_DAY", "SPECIFIC_DATE"]).optional(),
  emissionStartDay: z.number().int().nullable().optional(),
  frequency: z.enum([
    "ANNUAL",
    "BIMONTHLY",
    "BIWEEKLY",
    "MONTHLY",
    "ONCE",
    "QUARTERLY",
    "SEMIANNUAL",
    "WEEKLY",
  ]),
  lateFeeGraceDays: z.number().int().nullable().optional(),
  lateFeeMode: z.enum(["FIXED", "NONE", "PERCENTAGE"]).optional(),
  lateFeeValue: z.number().nullable().optional(),
  monthsToGenerate: z.number().int().optional(),
  name: z.string().min(1),
  notes: z.string().nullable().optional(),
  obligationType: z.enum(["DEBT", "LOAN", "OTHER", "SERVICE"]).optional(),
  ownership: z.enum(["COMPANY", "MIXED", "OWNER", "THIRD_PARTY"]).optional(),
  recurrenceType: z.enum(["ONE_OFF", "RECURRING"]).optional(),
  reminderDaysBefore: z.number().int().optional(),
  serviceType: z.enum([
    "BUSINESS",
    "LEASE",
    "OTHER",
    "PERSONAL",
    "SOFTWARE",
    "SUPPLIER",
    "TAX",
    "UTILITY",
  ]),
  startDate: z.coerce.date(),
  transactionCategoryId: z.number().int().nullable().optional(),
});

export const generateSchedulesSchema = z.object({
  fromDate: z.coerce.date().optional(),
  id: z.string().min(1),
  months: z.number().int().min(1).max(120).optional(),
});

export const payScheduleSchema = z.object({
  id: z.number().int().positive(),
  note: z.string().max(1000).optional().nullable(),
  paidAmount: z.coerce.number().min(0),
  paidDate: z.coerce.date(),
  transactionId: z.coerce.number().int(),
  transactionSource: z.enum(["release", "settlement", "withdraw"]).optional(),
});

export const editScheduleSchema = z.object({
  dueDate: z.coerce.date().optional(),
  expectedAmount: z.coerce.number().min(0).optional(),
  id: z.number().int().positive(),
  note: z.string().max(1000).optional().nullable(),
});

export const skipScheduleSchema = z.object({
  id: z.number().int().positive(),
  reason: z.string().min(1).max(500),
});

const decimalOutputSchema = z.union([z.number(), z.string()]);

export const serviceCategorySchema = z.strictObject({
  color: z.string().nullable(),
  id: z.number().int(),
  name: z.string(),
});

export const serviceTransactionSchema = z.strictObject({
  amount: decimalOutputSchema.nullable().optional(),
  description: z.string().nullable().optional(),
  id: z.number().int(),
  timestamp: z.coerce.date().nullable().optional(),
});

export const serviceScheduleSchema = z.strictObject({
  createdAt: z.coerce.date(),
  dueDate: z.coerce.date(),
  effectiveAmount: decimalOutputSchema,
  expectedAmount: decimalOutputSchema,
  financialTransactionId: z.number().int().nullable().optional(),
  id: z.number().int(),
  lateFeeAmount: decimalOutputSchema,
  note: z.string().nullable(),
  overdueDays: z.number().int(),
  paidAmount: decimalOutputSchema.nullable().optional(),
  paidDate: z.coerce.date().nullable().optional(),
  periodEnd: z.coerce.date(),
  periodStart: z.coerce.date(),
  serviceId: z.number().int(),
  status: z.enum(["PAID", "PARTIAL", "PENDING", "SKIPPED"]),
  transaction: serviceTransactionSchema.nullable().optional(),
  transactionId: z.number().int().nullable(),
  updatedAt: z.coerce.date(),
});

export const serviceSummarySchema = z.strictObject({
  accountReference: z.string().nullable(),
  amountIndexation: z.enum(["NONE", "UF"]),
  autoLinkTransactions: z.boolean(),
  category: z.string().nullable(),
  counterpartAccountBankName: z.string().nullable(),
  counterpartAccountId: z.number().int().nullable(),
  counterpartAccountIdentifier: z.string().nullable(),
  counterpartAccountType: z.string().nullable(),
  counterpartId: z.number().int().nullable(),
  counterpartName: z.string().nullable(),
  createdAt: z.coerce.date(),
  defaultAmount: decimalOutputSchema,
  detail: z.string().nullable(),
  dueDay: z.number().int().nullable(),
  emissionDay: z.number().int().nullable(),
  emissionEndDay: z.number().int().nullable(),
  emissionExactDate: z.coerce.date().nullable(),
  emissionMode: z.enum(["DATE_RANGE", "FIXED_DAY", "SPECIFIC_DATE"]),
  emissionStartDay: z.number().int().nullable(),
  frequency: z.enum([
    "ANNUAL",
    "BIMONTHLY",
    "BIWEEKLY",
    "MONTHLY",
    "ONCE",
    "QUARTERLY",
    "SEMIANNUAL",
    "WEEKLY",
  ]),
  id: z.number().int(),
  lateFeeGraceDays: z.number().int().nullable(),
  lateFeeMode: z.enum(["FIXED", "NONE", "PERCENTAGE"]),
  lateFeeValue: decimalOutputSchema.nullable(),
  name: z.string(),
  nextGenerationMonths: z.number().int(),
  notes: z.string().nullable(),
  obligationType: z.enum(["DEBT", "LOAN", "OTHER", "SERVICE"]),
  overdueCount: z.number().int(),
  ownership: z.enum(["COMPANY", "MIXED", "OWNER", "THIRD_PARTY"]),
  pendingCount: z.number().int(),
  publicId: z.string(),
  recurrenceType: z.enum(["ONE_OFF", "RECURRING"]),
  reminderDaysBefore: z.number().int(),
  serviceType: z.enum([
    "BUSINESS",
    "LEASE",
    "OTHER",
    "PERSONAL",
    "SOFTWARE",
    "SUPPLIER",
    "TAX",
    "UTILITY",
  ]),
  startDate: z.coerce.date(),
  status: z.enum(["ACTIVE", "ARCHIVED", "INACTIVE"]),
  totalExpected: decimalOutputSchema,
  totalPaid: decimalOutputSchema,
  transactionCategory: serviceCategorySchema.nullable().optional(),
  transactionCategoryId: z.number().int().nullable(),
  updatedAt: z.coerce.date(),
});

export const statusOkSchema = z.object({
  status: z.literal("ok"),
});

export const listResponseSchema = z.object({
  services: z.array(serviceSummarySchema),
  status: z.literal("ok"),
});

export const detailResponseSchema = z.object({
  schedules: z.array(serviceScheduleSchema),
  service: serviceSummarySchema,
  status: z.literal("ok"),
});

export const scheduleResponseSchema = z.object({
  schedule: serviceScheduleSchema,
  status: z.literal("ok"),
});

export const syncResponseSchema = z.object({
  data: z.object({
    matchedSchedules: z.number(),
    processedSchedules: z.number(),
    scannedTransactions: z.number(),
    servicesCount: z.number(),
  }),
  status: z.literal("ok"),
});

export const generateSchedulesResponseSchema = z.object({
  generated: z.number(),
  message: z.string().optional(),
  schedules: z.array(serviceScheduleSchema),
  service: serviceSummarySchema,
  status: z.literal("ok"),
});

export const servicesContract = {
  create: oc
    .route({ method: "POST", path: "/" })
    .input(serviceCreateSchema)
    .output(detailResponseSchema),
  delete: oc
    .route({ method: "DELETE", path: "/{id}" })
    .input(serviceIdSchema)
    .output(statusOkSchema),
  detail: oc
    .route({ method: "GET", path: "/{id}" })
    .input(serviceIdSchema)
    .output(detailResponseSchema),
  list: oc.route({ method: "GET", path: "/" }).output(listResponseSchema),
  regenerateSchedules: oc
    .route({ method: "POST", path: "/{id}/schedules" })
    .input(generateSchedulesSchema)
    .output(generateSchedulesResponseSchema),
  scheduleEdit: oc
    .route({ method: "PATCH", path: "/schedules/{id}" })
    .input(editScheduleSchema)
    .output(scheduleResponseSchema),
  schedulePay: oc
    .route({ method: "POST", path: "/schedules/{id}/pay" })
    .input(payScheduleSchema)
    .output(scheduleResponseSchema),
  scheduleSkip: oc
    .route({ method: "POST", path: "/schedules/{id}/skip" })
    .input(skipScheduleSchema)
    .output(scheduleResponseSchema),
  scheduleUnlink: oc
    .route({ method: "POST", path: "/schedules/{id}/unlink" })
    .input(scheduleIdSchema)
    .output(scheduleResponseSchema),
  syncAllTransactions: oc
    .route({ method: "POST", path: "/sync/transactions" })
    .output(syncResponseSchema),
  syncTransactions: oc
    .route({ method: "POST", path: "/{id}/sync-transactions" })
    .input(serviceIdSchema)
    .output(syncResponseSchema),
  update: oc
    .route({ method: "PUT", path: "/{id}" })
    .input(z.object({ id: z.string().min(1), payload: serviceCreateSchema }))
    .output(detailResponseSchema),
};

export type ServicesContract = typeof servicesContract;
