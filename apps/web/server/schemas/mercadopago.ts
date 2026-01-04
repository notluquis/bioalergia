/**
 * MercadoPago Release Report API Schemas
 * Documentation: https://www.mercadopago.com/developers/es/docs/checkout-pro/additional-content/reports/released-money
 */
import { z } from "zod";
export {
  MP_DEFAULT_COLUMNS,
  MP_REPORT_COLUMNS,
  MP_REPORT_LANGUAGES,
  MP_WEEKDAYS,
  type MpReportColumn,
  type MpReportLanguage,
  type MpWeekday,
} from "../../shared/mercadopago.js";

// Import shared Zod schemas and constants
import {
  MP_REPORT_LANGUAGES,
  MpColumnSchema,
  MpConfigSchema,
  MpFrequencySchema,
  MpSftpInfoSchema,
} from "../../shared/mercadopago.js";

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS & SHARED SCHEMAS
// ═══════════════════════════════════════════════════════════════════

// Re-export for backend usage (aliases if needed for backward compatibility)
export const mpConfigSchema = MpConfigSchema;
export const frequencySchema = MpFrequencySchema;
export const columnSchema = MpColumnSchema;
export const sftpInfoSchema = MpSftpInfoSchema;

/** GET /v1/account/release_report/config - Response (fewer fields than request) */
export const mpConfigResponseSchema = z.object({
  file_name_prefix: z.string(),
  columns: z.array(columnSchema),
  frequency: frequencySchema,
  report_translation: z.enum(MP_REPORT_LANGUAGES).optional(),
  notification_email_list: z.array(z.string().email().or(z.null())).optional(),
  display_timezone: z.string().optional(),
  include_withdrawal_at_end: z.boolean(),
  execute_after_withdrawal: z.boolean(),
  scheduled: z.boolean(),
});

// ═══════════════════════════════════════════════════════════════════
// BACKEND-SPECIFIC SCHEMAS (Not needed in frontend)
// ═══════════════════════════════════════════════════════════════════

const internalManagementSchema = z.object({
  is_visible: z.boolean().optional(),
  notify: z.boolean().optional(),
  use_exact_time: z.boolean().optional(),
  is_reserve: z.boolean().optional(),
  is_test: z.boolean().optional(),
});

/** POST /v1/account/release_report - Create manual report */
export const createReportSchema = z.object({
  begin_date: z.string(), // UTC ISO 8601: "2023-01-01T00:00:00Z"
  end_date: z.string(),
});

/**
 * Report item response
 */
export const reportSchema = z.object({
  id: z.number(),
  begin_date: z.string(),
  end_date: z.string(),
  created_from: z.enum(["manual", "schedule"]),
  // Optional fields
  account_id: z.number().optional(),
  currency_id: z.string().optional(),
  generation_date: z.string().optional(),
  internal_management: z.array(internalManagementSchema).optional(),
  last_modified: z.string().optional(),
  report_id: z.number().optional(),
  retries: z.number().optional(),
  status: z.string().optional(),
  sub_type: z.literal("release").optional(),
  user_id: z.number().optional(),
  format: z.string().optional(),
  file_name: z.string().optional(),
  mode: z.string().optional(),
  generated: z.boolean().optional(),
  report_type: z.string().optional(),
  external_id: z.string().optional(),
});

/** GET /release_report/list - Array of reports */
export const listReportsResponseSchema = z.array(reportSchema);

// ═══════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════

export type MpFrequency = z.infer<typeof frequencySchema>;
export type MpConfig = z.infer<typeof mpConfigSchema>;
export type MpConfigResponse = z.infer<typeof mpConfigResponseSchema>;
export type MpReport = z.infer<typeof reportSchema>;
export type CreateReportRequest = z.infer<typeof createReportSchema>;
