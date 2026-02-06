import type { db, JsonValue } from "@finanzas/db";
import { Decimal } from "decimal.js";

// Infer Input types from the db client
type SettlementManyArgs = Parameters<typeof db.settlementTransaction.createMany>[0];
type ReleaseManyArgs = Parameters<typeof db.releaseTransaction.createMany>[0];

// Extract the single item type from 'data' which can be T | T[]
type ExtractDataInput<T> = T extends { data: infer D } ? (D extends (infer U)[] ? U : D) : never;

type SettlementTransactionInput = ExtractDataInput<SettlementManyArgs>;
type ReleaseTransactionInput = ExtractDataInput<ReleaseManyArgs>;

// Type for raw MercadoPago CSV rows
export type RawValue = string | number | null | undefined;
export type MercadoPagoRowRaw = Record<string, RawValue>;
type NonNullJsonValue = Exclude<JsonValue, null>;

const toStringValue = (value: RawValue): string | undefined => {
  if (value == null) {
    return undefined;
  }
  return typeof value === "string" ? value : String(value);
};

const toText = (value: RawValue, fallback = ""): string => toStringValue(value) ?? fallback;

const toNullableString = (value: RawValue): string | null => {
  const str = toStringValue(value);
  return str && str.length > 0 ? str : null;
};

const toInt = (value: RawValue): number | null => {
  const str = toStringValue(value);
  if (!str) {
    return null;
  }
  const parsed = Number.parseInt(str, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

// Helper parsers
export function parseDateRequired(value: RawValue): Date {
  const str = toStringValue(value);
  if (!str) {
    return new Date();
  }
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function parseDateOptional(value: RawValue): Date | null {
  const str = toStringValue(value);
  if (!str) {
    return null;
  }
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseDecimal(value: RawValue, fallback: string | number | Decimal): Decimal;
export function parseDecimal(
  value: RawValue,
  fallback?: string | number | Decimal,
): Decimal | undefined;
export function parseDecimal(value: RawValue, fallback?: string | number | Decimal) {
  const toDecimal = (input: string | number | Decimal) =>
    input instanceof Decimal ? input : new Decimal(input);
  if (value == null || value === "") {
    return fallback === undefined ? undefined : toDecimal(fallback);
  }
  if (typeof value === "number") {
    return new Decimal(value);
  }
  if (typeof value === "string") {
    const normalized = value.replace(",", ".");
    if (!normalized.trim()) {
      return fallback === undefined ? undefined : toDecimal(fallback);
    }
    try {
      return new Decimal(normalized);
    } catch (err) {
      console.error(
        `[parseDecimal] Error parsing value "${value}" (normalized: "${normalized}"):`,
        err,
      );
      throw err;
    }
  }
  throw new Error(`parseDecimal: Unexpected value type: ${typeof value}`);
}

export function parseBigInt(value: RawValue): bigint | undefined {
  const str = toStringValue(value);
  if (!str) {
    return undefined;
  }
  try {
    return BigInt(str);
  } catch {
    return undefined;
  }
}

export function parseJson(value: unknown): NonNullJsonValue | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value === "string") {
    if (!value.trim()) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(value) as JsonValue;
      return parsed === null ? undefined : (parsed as NonNullJsonValue);
    } catch {
      return undefined;
    }
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "object") {
    return value as NonNullJsonValue;
  }
  return undefined;
}

const parseBoolean = (value: RawValue): boolean | null => {
  const str = toStringValue(value);
  if (!str) {
    return null;
  }
  const normalized = str.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }
  return null;
};

// Mapper for Settlement Report
export function mapRowToSettlementTransaction(row: MercadoPagoRowRaw): SettlementTransactionInput {
  return {
    sourceId: toText(row.SOURCE_ID), // Empty = will be skipped as invalid
    transactionDate: parseDateRequired(row.TRANSACTION_DATE),
    settlementDate: parseDateOptional(row.SETTLEMENT_DATE),
    moneyReleaseDate: parseDateOptional(row.MONEY_RELEASE_DATE),
    externalReference: toNullableString(row.EXTERNAL_REFERENCE),
    userId: toNullableString(row.USER_ID),
    paymentMethodType: toNullableString(row.PAYMENT_METHOD_TYPE),
    paymentMethod: toNullableString(row.PAYMENT_METHOD),
    site: toNullableString(row.SITE),
    transactionType: toText(row.TRANSACTION_TYPE, "Unknown"),
    transactionAmount: parseDecimal(row.TRANSACTION_AMOUNT, 0),
    transactionCurrency: toText(row.TRANSACTION_CURRENCY, "ARS"),
    sellerAmount: parseDecimal(row.SELLER_AMOUNT),
    feeAmount: parseDecimal(row.FEE_AMOUNT),
    settlementNetAmount: parseDecimal(row.SETTLEMENT_NET_AMOUNT),
    settlementCurrency: toNullableString(row.SETTLEMENT_CURRENCY),
    realAmount: parseDecimal(row.REAL_AMOUNT),
    couponAmount: parseDecimal(row.COUPON_AMOUNT),
    metadata: parseJson(row.METADATA),
    mkpFeeAmount: parseDecimal(row.MKP_FEE_AMOUNT),
    financingFeeAmount: parseDecimal(row.FINANCING_FEE_AMOUNT),
    shippingFeeAmount: parseDecimal(row.SHIPPING_FEE_AMOUNT),
    taxesAmount: parseDecimal(row.TAXES_AMOUNT),
    installments: toInt(row.INSTALLMENTS),
    taxDetail: toNullableString(row.TAX_DETAIL),
    taxesDisaggregated: parseJson(row.TAXES_DISAGGREGATED),
    description: toNullableString(row.DESCRIPTION),
    cardInitialNumber: toNullableString(row.CARD_INITIAL_NUMBER),
    operationTags: parseJson(row.OPERATION_TAGS),
    businessUnit: toNullableString(row.BUSINESS_UNIT),
    subUnit: toNullableString(row.SUB_UNIT),
    productSku: toNullableString(row.PRODUCT_SKU),
    saleDetail: toNullableString(row.SALE_DETAIL),
    transactionIntentId: toNullableString(row.TRANSACTION_INTENT_ID),
    franchise: toNullableString(row.FRANCHISE),
    issuerName: toNullableString(row.ISSUER_NAME),
    lastFourDigits: toNullableString(row.LAST_FOUR_DIGITS),
    orderMp: toNullableString(row.ORDER_MP),
    invoicingPeriod: toNullableString(row.INVOICING_PERIOD),
    payBankTransferId: toNullableString(row.PAY_BANK_TRANSFER_ID),
    isReleased: parseBoolean(row.IS_RELEASED),
    tipAmount: parseDecimal(row.TIP_AMOUNT),
    purchaseId: toNullableString(row.PURCHASE_ID),
    totalCouponAmount: parseDecimal(row.TOTAL_COUPON_AMOUNT),
    posId: toNullableString(row.POS_ID),
    posName: toNullableString(row.POS_NAME),
    externalPosId: toNullableString(row.EXTERNAL_POS_ID),
    storeId: toNullableString(row.STORE_ID),
    storeName: toNullableString(row.STORE_NAME),
    externalStoreId: toNullableString(row.EXTERNAL_STORE_ID),
    poiId: toNullableString(row.POI_ID),
    orderId: parseBigInt(row.ORDER_ID),
    shippingId: parseBigInt(row.SHIPPING_ID),
    shipmentMode: toNullableString(row.SHIPMENT_MODE),
    packId: parseBigInt(row.PACK_ID),
    shippingOrderId: toNullableString(row.SHIPPING_ORDER_ID),
    poiWalletName: toNullableString(row.POI_WALLET_NAME),
    poiBankName: toNullableString(row.POI_BANK_NAME),
  };
}

// Mapper for Release Report
export function mapRowToReleaseTransaction(row: MercadoPagoRowRaw): ReleaseTransactionInput {
  return {
    sourceId: toText(row.SOURCE_ID), // Empty = will be skipped as invalid
    date: parseDateRequired(row.DATE),
    externalReference: toNullableString(row.EXTERNAL_REFERENCE),
    recordType: toNullableString(row.RECORD_TYPE),
    description: toNullableString(row.DESCRIPTION),
    netCreditAmount: parseDecimal(row.NET_CREDIT_AMOUNT),
    netDebitAmount: parseDecimal(row.NET_DEBIT_AMOUNT),
    grossAmount: parseDecimal(row.GROSS_AMOUNT, 0),
    sellerAmount: parseDecimal(row.SELLER_AMOUNT),
    mpFeeAmount: parseDecimal(row.MP_FEE_AMOUNT),
    financingFeeAmount: parseDecimal(row.FINANCING_FEE_AMOUNT),
    shippingFeeAmount: parseDecimal(row.SHIPPING_FEE_AMOUNT),
    taxesAmount: parseDecimal(row.TAXES_AMOUNT),
    couponAmount: parseDecimal(row.COUPON_AMOUNT),
    installments: toInt(row.INSTALLMENTS),
    paymentMethod: toNullableString(row.PAYMENT_METHOD),
    taxDetail: toNullableString(row.TAX_DETAIL),
    taxAmountTelco: parseDecimal(row.TAX_AMOUNT_TELCO),
    transactionApprovalDate: parseDateOptional(row.TRANSACTION_APPROVAL_DATE),
    posId: toNullableString(row.POS_ID),
    posName: toNullableString(row.POS_NAME),
    externalPosId: toNullableString(row.EXTERNAL_POS_ID),
    storeId: toNullableString(row.STORE_ID),
    storeName: toNullableString(row.STORE_NAME),
    externalStoreId: toNullableString(row.EXTERNAL_STORE_ID),
    currency: toNullableString(row.CURRENCY),
    taxesDisaggregated: parseJson(row.TAXES_DISAGGREGATED),
    shippingId: parseBigInt(row.SHIPPING_ID),
    shipmentMode: toNullableString(row.SHIPMENT_MODE),
    orderId: parseBigInt(row.ORDER_ID),
    packId: parseBigInt(row.PACK_ID),
    metadata: parseJson(row.METADATA),
    effectiveCouponAmount: parseDecimal(row.EFFECTIVE_COUPON_AMOUNT),
    poiId: toNullableString(row.POI_ID),
    cardInitialNumber: toNullableString(row.CARD_INITIAL_NUMBER),
    operationTags: parseJson(row.OPERATION_TAGS),
    itemId: toNullableString(row.ITEM_ID),
    poiBankName: toNullableString(row.POI_BANK_NAME),
    poiWalletName: toNullableString(row.POI_WALLET_NAME),
    businessUnit: toNullableString(row.BUSINESS_UNIT),
    subUnit: toNullableString(row.SUB_UNIT),
    balanceAmount: parseDecimal(row.BALANCE_AMOUNT),
    payoutBankAccountNumber: toNullableString(row.PAYOUT_BANK_ACCOUNT_NUMBER),
    productSku: toNullableString(row.PRODUCT_SKU),
    saleDetail: toNullableString(row.SALE_DETAIL),
    paymentMethodType: toNullableString(row.PAYMENT_METHOD_TYPE),
    transactionIntentId: toNullableString(row.TRANSACTION_INTENT_ID),
    franchise: toNullableString(row.FRANCHISE),
    issuerName: toNullableString(row.ISSUER_NAME),
    lastFourDigits: toNullableString(row.LAST_FOUR_DIGITS),
    orderMp: toNullableString(row.ORDER_MP),
    purchaseId: toNullableString(row.PURCHASE_ID),
    shippingOrderId: toNullableString(row.SHIPPING_ORDER_ID),
  };
}
