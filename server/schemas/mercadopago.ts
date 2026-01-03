/**
 * MercadoPago Release Report API Schemas
 * Documentation: https://www.mercadopago.com/developers/es/docs/checkout-pro/additional-content/reports/released-money
 */
import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

/** Valid column keys for Release Report - 53 columns */
export const MP_REPORT_COLUMNS = [
  "DATE",
  "SOURCE_ID",
  "EXTERNAL_REFERENCE",
  "RECORD_TYPE",
  "DESCRIPTION",
  "NET_CREDIT_AMOUNT",
  "NET_DEBIT_AMOUNT",
  "SELLER_AMOUNT",
  "GROSS_AMOUNT",
  "METADATA",
  "MP_FEE_AMOUNT",
  "FINANCING_FEE_AMOUNT",
  "SHIPPING_FEE_AMOUNT",
  "TAXES_AMOUNT",
  "COUPON_AMOUNT",
  "INSTALLMENTS",
  "PAYMENT_METHOD",
  "PAYMENT_METHOD_TYPE",
  "TAX_DETAIL",
  "TAX_AMOUNT_TELCO",
  "TRANSACTION_APPROVAL_DATE",
  "POS_ID",
  "POS_NAME",
  "EXTERNAL_POS_ID",
  "STORE_ID",
  "STORE_NAME",
  "EXTERNAL_STORE_ID",
  "ORDER_ID",
  "SHIPPING_ID",
  "SHIPMENT_MODE",
  "PACK_ID",
  "TAXES_DISAGGREGATED",
  "EFFECTIVE_COUPON_AMOUNT",
  "POI_ID",
  "CARD_INITIAL_NUMBER",
  "OPERATION_TAGS",
  "ITEM_ID",
  "BALANCE_AMOUNT",
  "PAYOUT_BANK_ACCOUNT_NUMBER",
  "PRODUCT_SKU",
  "SALE_DETAIL",
  "CURRENCY",
  "FRANCHISE",
  "LAST_FOUR_DIGITS",
  "ORDER_MP",
  "TRANSACTION_INTENT_ID",
  "PURCHASE_ID",
  "IS_RELEASED",
  "SHIPPING_ORDER_ID",
  "ISSUER_NAME",
] as const;

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const REPORT_LANGUAGES = ["en", "es", "pt"] as const;

// ═══════════════════════════════════════════════════════════════════
// SHARED SCHEMAS (reused across endpoints)
// ═══════════════════════════════════════════════════════════════════

export const columnSchema = z.object({ key: z.enum(MP_REPORT_COLUMNS) });

/**
 * Frequency for automatic report generation
 * - daily: value = 0, hour = 0-23
 * - weekly: value = "monday"|"tuesday"|...|"sunday", hour = 0-23
 * - monthly: value = 1-31 (day of month), hour = 0-23
 */
export const frequencySchema = z.object({
  type: z.enum(["daily", "weekly", "monthly"]),
  value: z.union([z.number().int().min(0).max(31), z.enum(WEEKDAYS)]),
  hour: z.number().int().min(0).max(23),
});

export const sftpInfoSchema = z
  .object({
    server: z.string().optional(),
    password: z.string().optional(),
    remote_dir: z.string().optional(),
    port: z.number().int().optional(),
    username: z.string().optional(),
  })
  .optional();

const internalManagementSchema = z.object({
  is_visible: z.boolean().optional(),
  notify: z.boolean().optional(),
  use_exact_time: z.boolean().optional(),
  is_reserve: z.boolean().optional(),
  is_test: z.boolean().optional(),
});

// ═══════════════════════════════════════════════════════════════════
// REPORT SCHEMAS
// ═══════════════════════════════════════════════════════════════════

/** POST /v1/account/release_report - Create manual report */
export const createReportSchema = z.object({
  begin_date: z.string(), // UTC ISO 8601: "2023-01-01T00:00:00Z"
  end_date: z.string(),
});

/**
 * Report item response - used by:
 * - POST /release_report (create)
 * - GET /release_report/list (array of these)
 * - POST/DELETE /release_report/schedule
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
// CONFIG SCHEMAS
// ═══════════════════════════════════════════════════════════════════

/** POST/PUT /v1/account/release_report/config - Create/Update config */
export const mpConfigSchema = z.object({
  // Required
  file_name_prefix: z.string().min(1),
  columns: z.array(columnSchema).min(1),
  frequency: frequencySchema,
  // Optional (with defaults noted)
  sftp_info: sftpInfoSchema,
  separator: z.string().optional(), // default: ","
  display_timezone: z.string().optional(), // default: "GMT-04"
  report_translation: z.enum(REPORT_LANGUAGES).optional(),
  notification_email_list: z.array(z.string().email().or(z.null())).optional(),
  include_withdrawal_at_end: z.boolean().optional(), // default: true
  check_available_balance: z.boolean().optional(), // default: true
  compensate_detail: z.boolean().optional(), // default: true
  execute_after_withdrawal: z.boolean().optional(), // default: false
  scheduled: z.boolean().optional(), // default: false
});

/** GET /v1/account/release_report/config - Response (fewer fields than request) */
export const mpConfigResponseSchema = z.object({
  file_name_prefix: z.string(),
  columns: z.array(columnSchema),
  frequency: frequencySchema,
  report_translation: z.enum(REPORT_LANGUAGES).optional(),
  notification_email_list: z.array(z.string().email().or(z.null())).optional(),
  display_timezone: z.string().optional(),
  include_withdrawal_at_end: z.boolean(),
  execute_after_withdrawal: z.boolean(),
  scheduled: z.boolean(),
});

// ═══════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════

export type MpReportColumn = (typeof MP_REPORT_COLUMNS)[number];
export type MpFrequency = z.infer<typeof frequencySchema>;
export type MpConfig = z.infer<typeof mpConfigSchema>;
export type MpConfigResponse = z.infer<typeof mpConfigResponseSchema>;
export type MpReport = z.infer<typeof reportSchema>;
export type CreateReportRequest = z.infer<typeof createReportSchema>;
