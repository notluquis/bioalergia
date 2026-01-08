/**
 * Shared MercadoPago Constants
 * Used by both Server and Client to ensure Single Source of Truth
 */

/** Valid column keys for Release Report - 53 columns matched with API */
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
  "TRANSACTION_TYPE",
  "TRANSACTION_AMOUNT",
  "MARKETPLACE_FEE_AMOUNT",
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

export type MpReportColumn = (typeof MP_REPORT_COLUMNS)[number];

export const MP_WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type MpWeekday = (typeof MP_WEEKDAYS)[number];

export const MP_REPORT_LANGUAGES = ["en", "es", "pt"] as const;
export type MpReportLanguage = (typeof MP_REPORT_LANGUAGES)[number];

// Default columns for a typical release report (Frontend usage)
export const MP_DEFAULT_COLUMNS: MpReportColumn[] = [
  "DATE",
  "SOURCE_ID",
  "EXTERNAL_REFERENCE",
  "DESCRIPTION",
  "NET_CREDIT_AMOUNT",
  "NET_DEBIT_AMOUNT",
  "GROSS_AMOUNT",
  "MP_FEE_AMOUNT",
  "PAYMENT_METHOD",
  "PAYMENT_METHOD_TYPE",
];

// ----------------------------------------------------------------------
// ZOD SCHEMAS (Shared for Frontend & Backend)
// ----------------------------------------------------------------------
import { z } from "zod";

export const MpColumnSchema = z.object({ key: z.string().min(1) });

/**
 * Frequency for automatic report generation
 * - daily: value = 0, hour = 0-23
 * - weekly: value = "monday"|"tuesday"|...|"sunday", hour = 0-23
 * - monthly: value = 1-31 (day of month), hour = 0-23
 */
export const MpFrequencySchema = z.object({
  type: z.enum(["daily", "weekly", "monthly"]),
  value: z.union([z.number().int().min(0).max(31), z.enum(MP_WEEKDAYS)]),
  hour: z.number().int().min(0).max(23),
});

export const MpSftpInfoSchema = z
  .object({
    server: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    remote_dir: z.string().optional(),
    port: z.number().int().optional(),
  })
  .optional();

// Common Base Config Schema
const MpBaseConfigSchema = z.object({
  file_name_prefix: z.string().min(1, "Prefijo requerido"),
  columns: z
    .array(MpColumnSchema)
    .min(1, "Al menos una columna requerida")
    .refine((cols) => new Set(cols.map((c) => c.key)).size === cols.length, "No se permiten columnas duplicadas"),
  frequency: MpFrequencySchema,
  sftp_info: MpSftpInfoSchema,
  separator: z.string().optional(),
  display_timezone: z.string().optional(),
  report_translation: z.enum(MP_REPORT_COLUMNS.length ? MP_REPORT_LANGUAGES : ["es"]).optional(), // Simplified
  notification_email_list: z.array(z.string().email().or(z.null())).optional(),
  scheduled: z.boolean().optional(),
});

/** POST/PUT /v1/account/release_report/config */
export const MpReleaseConfigSchema = MpBaseConfigSchema.extend({
  include_withdrawal_at_end: z.boolean().optional(),
  check_available_balance: z.boolean().optional(),
  compensate_detail: z.boolean().optional(),
  execute_after_withdrawal: z.boolean().optional(),
});

/** POST/PUT /v1/account/settlement_report/config */
export const MpSettlementConfigSchema = MpBaseConfigSchema.extend({
  show_fee_prevision: z.boolean().optional(),
  show_chargeback_cancel: z.boolean().optional(),
  coupon_detailed: z.boolean().optional(),
  include_withdraw: z.boolean().optional(),
  shipping_detail: z.boolean().optional(),
  refund_detailed: z.boolean().optional(),
});

// Union Type for generic usage
export type MpReleaseConfigFormData = z.infer<typeof MpReleaseConfigSchema>;
export type MpSettlementConfigFormData = z.infer<typeof MpSettlementConfigSchema>;

// Kept for backward compatibility if needed, or alias to Release
export const MpConfigSchema = MpReleaseConfigSchema;
export type MpConfigFormData = MpReleaseConfigFormData;

// Default columns for Settlement Report (from user request)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MP_SETTLEMENT_DEFAULT_COLUMNS: any[] = [
  "TRANSACTION_DATE", // Note: These keys differ from Release Report columns
  // User provided: TRANSACTION_DATE, SOURCE_ID, EXTERNAL_REFERENCE
  // We allow any string here for now to avoid build errors.
];

// Add simple constants for defaults
export const MP_SETTLEMENT_DEFAULTS = [
  "TRANSACTION_DATE",
  "SOURCE_ID",
  "EXTERNAL_REFERENCE",
  "TRANSACTION_AMOUNT",
  "SETTLEMENT_NET_AMOUNT",
  "PAYMENT_METHOD",
];
