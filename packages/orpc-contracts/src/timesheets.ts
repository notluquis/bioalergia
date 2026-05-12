import { oc } from "@orpc/contract";
import { z } from "zod";

export const timesheetEntrySchema = z.looseObject({
  comment: z.string().nullable(),
  employee_id: z.number(),
  end_time: z.string().nullable(),
  id: z.number(),
  overtime_minutes: z.number(),
  start_time: z.string().nullable(),
  work_date: z.union([z.string(), z.date()]),
  worked_minutes: z.number(),
});

export const timesheetListEntrySchema = timesheetEntrySchema.extend({
  employee_name: z.string().optional(),
  employee_role: z.string().nullable().optional(),
  full_name: z.string().optional(),
});

export const timesheetEmailSummarySchema = z.object({
  net: z.number(),
  overtimeMinutes: z.number().optional(),
  payDate: z.string(),
  retention: z.number(),
  retention_rate: z.number().nullable().optional(),
  retentionRate: z.number().nullable().optional(),
  role: z.string(),
  subtotal: z.number(),
  workedMinutes: z.number().optional(),
});

export const timesheetMonthInputSchema = z.object({
  employeeId: z.number().optional(),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

export const timesheetRangeInputSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const timesheetEmployeeRangeInputSchema = z.object({
  employeeId: z.number(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const timesheetEmployeeDetailInputSchema = z.object({
  employeeId: z.number(),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

export const timesheetMultiMonthInputSchema = z.object({
  employeeIds: z.array(z.number()).default([]),
  endMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  startMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

export const timesheetMultiDetailInputSchema = z.object({
  employeeIds: z.array(z.number()).default([]),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const timesheetBulkInputSchema = z.object({
  employee_id: z.number(),
  entries: z.array(z.any()).default([]),
  remove_ids: z.array(z.union([z.string(), z.number()])).default([]),
});

export const timesheetPayloadSchema = z.looseObject({
  comment: z.string().nullable().optional(),
  employee_id: z.number(),
  end_time: z.string().nullable().optional(),
  overtime_minutes: z.number().optional(),
  start_time: z.string().nullable().optional(),
  work_date: z.string(),
  worked_minutes: z.number().optional(),
});

export const updateTimesheetPayloadSchema = z.looseObject({});

export const timesheetEmailPayloadInputSchema = z.object({
  employeeEmail: z.email(),
  employeeId: z.number(),
  employeeName: z.string(),
  month: z.string(),
  monthLabel: z.string(),
  pdfBase64: z.string(),
  summary: timesheetEmailSummarySchema,
});

export const timesheetEmailPreviewInputSchema = timesheetEmailPayloadInputSchema.omit({
  pdfBase64: true,
});

export const timesheetSummaryEmployeeSchema = z.object({
  email: z.string().nullable(),
  employeeId: z.number(),
  extraAmount: z.number(),
  fullName: z.string(),
  hourlyRate: z.number(),
  hoursFormatted: z.string(),
  net: z.number(),
  overtimeFormatted: z.string(),
  overtimeMinutes: z.number(),
  overtimeRate: z.number(),
  payDate: z.string(),
  retention: z.number(),
  retention_rate: z.number().nullable().optional(),
  retentionRate: z.number().nullable().optional(),
  role: z.string(),
  subtotal: z.number(),
  workedMinutes: z.number(),
});

export const timesheetSummaryResponseSchema = z.looseObject({
  employees: z.array(timesheetSummaryEmployeeSchema).default([]),
  from: z.string(),
  month: z.string(),
  status: z.literal("ok"),
  to: z.string(),
  totals: z.looseObject({}).optional(),
});

export const timesheetRangeResponseSchema = z.object({
  entries: z.array(timesheetEntrySchema),
  from: z.string(),
  status: z.literal("ok"),
  to: z.string(),
});

export const timesheetListRangeResponseSchema = z.object({
  entries: z.array(timesheetEntrySchema),
  status: z.literal("ok"),
});

export const timesheetMonthsResponseSchema = z.object({
  months: z.array(z.string()),
  monthsWithData: z.array(z.string()),
  status: z.literal("ok"),
});

export const timesheetMultiMonthResponseSchema = z.object({
  data: z.record(
    z.string(),
    z.object({ entries: z.array(timesheetEntrySchema), month: z.string() })
  ),
  status: z.literal("ok"),
});

export const timesheetMultiDetailResponseSchema = z.object({
  entries: z.array(timesheetListEntrySchema),
});

export const timesheetStatusResponseSchema = z.object({
  inserted: z.number().optional(),
  message: z.string().optional(),
  removed: z.number().optional(),
  status: z.literal("ok"),
});

export const timesheetEntryResponseSchema = z.object({
  entry: timesheetEntrySchema,
  status: z.literal("ok"),
});

export const timesheetSalarySummaryEntrySchema = z.object({
  month: z.string(),
  net: z.number(),
  retention: z.number(),
  subtotal: z.number(),
});

export const timesheetSalarySummaryResponseSchema = z.object({
  data: z.record(z.string(), z.array(timesheetSalarySummaryEntrySchema)),
  from: z.string(),
  status: z.literal("ok"),
  to: z.string(),
});

export const timesheetPrepareEmailPayloadResponseSchema = z.object({
  payload: z.object({
    attachments: z.array(
      z.object({
        contentBase64: z.string(),
        contentType: z.string(),
        filename: z.string(),
      })
    ),
    from: z.string(),
    html: z.string(),
    subject: z.string(),
    text: z.string().optional(),
    to: z.string(),
  }),
  status: z.literal("ok"),
});

export const timesheetEmailPreviewResponseSchema = z.object({
  preview: z.object({
    attachmentName: z.string(),
    attachmentType: z.string(),
    from: z.string(),
    html: z.string(),
    subject: z.string(),
    text: z.string(),
    to: z.string(),
  }),
  status: z.literal("ok"),
});

export const timesheetPrepareEmailResponseSchema = z.object({
  emlBase64: z.string(),
  filename: z.string(),
  status: z.literal("ok"),
});

export const timesheetSalarySummaryInputSchema = z.object({
  employeeIds: z.array(z.number()).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  mode: z.enum(["auto", "range"]).default("range"),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export const timesheetRemoveInputSchema = z.object({ id: z.number() });

export const timesheetUpdateInputSchema = z.object({
  id: z.number(),
  payload: updateTimesheetPayloadSchema,
});

export const timesheetsContract = {
  bulkUpsert: oc
    .route({ method: "POST", path: "/bulk" })
    .input(timesheetBulkInputSchema)
    .output(timesheetStatusResponseSchema),
  create: oc
    .route({ method: "POST", path: "/" })
    .input(timesheetPayloadSchema)
    .output(timesheetEntryResponseSchema),
  employeeDetail: oc
    .route({ method: "GET", path: "/employee-detail" })
    .input(timesheetEmployeeDetailInputSchema)
    .output(timesheetRangeResponseSchema),
  employeeRange: oc
    .route({ method: "GET", path: "/employee-range" })
    .input(timesheetEmployeeRangeInputSchema)
    .output(timesheetRangeResponseSchema),
  listRange: oc
    .route({ method: "GET", path: "/range" })
    .input(timesheetRangeInputSchema)
    .output(timesheetListRangeResponseSchema),
  months: oc.route({ method: "GET", path: "/months" }).output(timesheetMonthsResponseSchema),
  multiDetail: oc
    .route({ method: "GET", path: "/multi-detail" })
    .input(timesheetMultiDetailInputSchema)
    .output(timesheetMultiDetailResponseSchema),
  multiMonth: oc
    .route({ method: "GET", path: "/multi-month" })
    .input(timesheetMultiMonthInputSchema)
    .output(timesheetMultiMonthResponseSchema),
  prepareEmail: oc
    .route({ method: "POST", path: "/prepare-email" })
    .input(timesheetEmailPayloadInputSchema)
    .output(timesheetPrepareEmailResponseSchema),
  prepareEmailPayload: oc
    .route({ method: "POST", path: "/prepare-email-payload" })
    .input(timesheetEmailPayloadInputSchema)
    .output(timesheetPrepareEmailPayloadResponseSchema),
  previewEmail: oc
    .route({ method: "POST", path: "/preview-email" })
    .input(timesheetEmailPreviewInputSchema)
    .output(timesheetEmailPreviewResponseSchema),
  remove: oc
    .route({ method: "DELETE", path: "/entry" })
    .input(timesheetRemoveInputSchema)
    .output(timesheetStatusResponseSchema),
  salarySummary: oc
    .route({ method: "GET", path: "/salary-summary" })
    .input(timesheetSalarySummaryInputSchema)
    .output(timesheetSalarySummaryResponseSchema),
  summary: oc
    .route({ method: "GET", path: "/summary" })
    .input(timesheetMonthInputSchema)
    .output(timesheetSummaryResponseSchema),
  update: oc
    .route({ method: "PUT", path: "/entry" })
    .input(timesheetUpdateInputSchema)
    .output(timesheetEntryResponseSchema),
};

export type TimesheetsContract = typeof timesheetsContract;
