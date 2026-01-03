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
