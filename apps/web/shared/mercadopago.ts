/**
 * Shared MercadoPago Constants
 * Used by both Server and Client to ensure Single Source of Truth
 */

/** Valid column keys for Release Report - 53 columns matched with API */
export const MP_RELEASE_COLUMNS = [
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

/** Valid column keys for Settlement Report (Todas las Transacciones) - 57 columns from official glossary */
export const MP_SETTLEMENT_COLUMNS = [
  "EXTERNAL_REFERENCE",
  "SOURCE_ID",
  "USER_ID",
  "PAYMENT_METHOD",
  "PAYMENT_METHOD_TYPE",
  "SITE",
  "TRANSACTION_TYPE",
  "TRANSACTION_AMOUNT",
  "TRANSACTION_CURRENCY",
  "SELLER_AMOUNT",
  "TRANSACTION_DATE",
  "FEE_AMOUNT",
  "SETTLEMENT_NET_AMOUNT",
  "SETTLEMENT_CURRENCY",
  "SETTLEMENT_DATE",
  "REAL_AMOUNT",
  "COUPON_AMOUNT",
  "METADATA",
  "MKP_FEE_AMOUNT",
  "FINANCING_FEE_AMOUNT",
  "SHIPPING_FEE_AMOUNT",
  "TAXES_AMOUNT",
  "INSTALLMENTS",
  "TAX_DETAIL",
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
  "POI_ID",
  "POI_WALLET_NAME",
  "POI_BANK_NAME",
  "DESCRIPTION",
  "MONEY_RELEASE_DATE",
  "IS_RELEASED",
  "CARD_INITIAL_NUMBER",
  "OPERATION_TAGS",
  "BUSINESS_UNIT",
  "SUB_UNIT",
  "PRODUCT_SKU",
  "SALE_DETAIL",
  "TIP_AMOUNT",
  "FRANCHISE",
  "LAST_FOUR_DIGITS",
  "ORDER_MP",
  "TRANSACTION_INTENT_ID",
  "INVOICING_PERIOD",
  "ISSUER_NAME",
  "PAY_BANK_TRANSFER_ID",
  "PURCHASE_ID",
  "SHIPPING_ORDER_ID",
] as const;

// Alias for backwards compatibility
export const MP_REPORT_COLUMNS = MP_RELEASE_COLUMNS;

export type MpReleaseColumn = (typeof MP_RELEASE_COLUMNS)[number];
export type MpSettlementColumn = (typeof MP_SETTLEMENT_COLUMNS)[number];
export type MpReportColumn = MpReleaseColumn; // Backwards compat

export const MP_WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type MpWeekday = (typeof MP_WEEKDAYS)[number];

export const MP_REPORT_LANGUAGES = ["en", "es", "pt"] as const;
export type MpReportLanguage = (typeof MP_REPORT_LANGUAGES)[number];

// Default columns for a typical release report (Frontend usage)
export const MP_DEFAULT_COLUMNS: MpReleaseColumn[] = [
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
export const MpFrequencySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("daily"),
    hour: z.number().int().min(0).max(23),
    value: z.undefined().or(z.literal(0)).optional(), // Explicitly allow undefined or 0
  }),
  z.object({
    type: z.literal("weekly"),
    hour: z.number().int().min(0).max(23),
    value: z.enum(MP_WEEKDAYS),
  }),
  z.object({
    type: z.literal("monthly"),
    hour: z.number().int().min(0).max(23),
    value: z.number().int().min(1).max(31),
  }),
]);

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

// Kept for backward compatibility but expanded
export const MpConfigSchema = MpReleaseConfigSchema.or(MpSettlementConfigSchema);
export type MpConfigFormData = MpReleaseConfigFormData | MpSettlementConfigFormData;

// Add simple constants for defaults
export const MP_SETTLEMENT_DEFAULTS = [
  "TRANSACTION_DATE",
  "SOURCE_ID",
  "EXTERNAL_REFERENCE",
  "TRANSACTION_AMOUNT",
  "SETTLEMENT_NET_AMOUNT",
  "PAYMENT_METHOD",
];
