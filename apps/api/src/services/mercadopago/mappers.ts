import type { db } from "@finanzas/db";

// Infer Input types from the db client
type SettlementManyArgs = Parameters<typeof db.settlementTransaction.createMany>[0];
type ReleaseManyArgs = Parameters<typeof db.releaseTransaction.createMany>[0];

// Extract the single item type from 'data' which can be T | T[]
type ExtractDataInput<T> = T extends { data: infer D } ? (D extends (infer U)[] ? U : D) : never;

type SettlementTransactionInput = ExtractDataInput<SettlementManyArgs>;
type ReleaseTransactionInput = ExtractDataInput<ReleaseManyArgs>;

// Type for raw MercadoPago CSV rows
type MercadoPagoRowRaw = Record<string, unknown>;

// Helper parsers
export function parseDate(val: string) {
  if (!val) return new Date();
  return new Date(val);
}

export function parseDecimal(val: unknown): number | string {
  if (!val) return 0;
  if (typeof val === "string") return val.replace(",", ".");
  if (typeof val === "number") return val;
  return 0;
}

export function parseBigInt(val: string): bigint | undefined {
  if (!val) return undefined;
  try {
    return BigInt(val);
  } catch {
    return undefined;
  }
}

export function parseJson(val: unknown): Record<string, unknown> | undefined {
  if (!val) return undefined;
  try {
    if (typeof val === "string") return JSON.parse(val) as Record<string, unknown>;
    if (typeof val === "object" && val !== null) return val as Record<string, unknown>;
    return undefined;
  } catch {
    return undefined;
  }
}

// Mapper for Settlement Report
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy mapper
export function mapRowToSettlementTransaction(row: MercadoPagoRowRaw): SettlementTransactionInput {
  return {
    sourceId: row.SOURCE_ID || "", // Empty = will be skipped as invalid
    transactionDate: parseDate(row.TRANSACTION_DATE),
    settlementDate: parseDate(row.SETTLEMENT_DATE),
    moneyReleaseDate: parseDate(row.MONEY_RELEASE_DATE),
    externalReference: row.EXTERNAL_REFERENCE || null,
    userId: row.USER_ID || null,
    paymentMethodType: row.PAYMENT_METHOD_TYPE || null,
    paymentMethod: row.PAYMENT_METHOD || null,
    site: row.SITE || null,
    transactionType: row.TRANSACTION_TYPE || "Unknown",
    transactionAmount: parseDecimal(row.TRANSACTION_AMOUNT),
    transactionCurrency: row.TRANSACTION_CURRENCY || "ARS",
    sellerAmount: parseDecimal(row.SELLER_AMOUNT),
    feeAmount: parseDecimal(row.FEE_AMOUNT),
    settlementNetAmount: parseDecimal(row.SETTLEMENT_NET_AMOUNT),
    settlementCurrency: row.SETTLEMENT_CURRENCY || null,
    realAmount: parseDecimal(row.REAL_AMOUNT),
    couponAmount: parseDecimal(row.COUPON_AMOUNT),
    metadata: parseJson(row.METADATA) || undefined, // Strict undefined
    mkpFeeAmount: parseDecimal(row.MKP_FEE_AMOUNT),
    financingFeeAmount: parseDecimal(row.FINANCING_FEE_AMOUNT),
    shippingFeeAmount: parseDecimal(row.SHIPPING_FEE_AMOUNT),
    taxesAmount: parseDecimal(row.TAXES_AMOUNT),
    installments: Number.parseInt(row.INSTALLMENTS || "0", 10) || null,
    taxDetail: row.TAX_DETAIL || null,
    taxesDisaggregated: parseJson(row.TAXES_DISAGGREGATED) || undefined,
    description: row.DESCRIPTION || null,
    cardInitialNumber: row.CARD_INITIAL_NUMBER || null,
    operationTags: parseJson(row.OPERATION_TAGS) || undefined,
    businessUnit: row.BUSINESS_UNIT || null,
    subUnit: row.SUB_UNIT || null,
    productSku: row.PRODUCT_SKU || null,
    saleDetail: row.SALE_DETAIL || null,
    transactionIntentId: row.TRANSACTION_INTENT_ID || null,
    franchise: row.FRANCHISE || null,
    issuerName: row.ISSUER_NAME || null,
    lastFourDigits: row.LAST_FOUR_DIGITS || null,
    orderMp: row.ORDER_MP || null,
    invoicingPeriod: row.INVOICING_PERIOD || null,
    payBankTransferId: row.PAY_BANK_TRANSFER_ID || null,
    isReleased: String(row.IS_RELEASED).toUpperCase() === "TRUE",
    tipAmount: parseDecimal(row.TIP_AMOUNT),
    purchaseId: row.PURCHASE_ID || null,
    totalCouponAmount: parseDecimal(row.TOTAL_COUPON_AMOUNT),
    posId: row.POS_ID || null,
    posName: row.POS_NAME || null,
    externalPosId: row.EXTERNAL_POS_ID || null,
    storeId: row.STORE_ID || null,
    storeName: row.STORE_NAME || null,
    externalStoreId: row.EXTERNAL_STORE_ID || null,
    poiId: row.POI_ID || null,
    orderId: parseBigInt(row.ORDER_ID),
    shippingId: parseBigInt(row.SHIPPING_ID),
    shipmentMode: row.SHIPMENT_MODE || null,
    packId: parseBigInt(row.PACK_ID),
    shippingOrderId: row.SHIPPING_ORDER_ID || null,
    poiWalletName: row.POI_WALLET_NAME || null,
    poiBankName: row.POI_BANK_NAME || null,
  };
}

// Mapper for Release Report
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy mapper
export function mapRowToReleaseTransaction(row: MercadoPagoRowRaw): ReleaseTransactionInput {
  return {
    sourceId: row.SOURCE_ID || "", // Empty = will be skipped as invalid
    date: parseDate(row.DATE),
    externalReference: row.EXTERNAL_REFERENCE || null,
    recordType: row.RECORD_TYPE || null,
    description: row.DESCRIPTION || null,
    netCreditAmount: parseDecimal(row.NET_CREDIT_AMOUNT),
    netDebitAmount: parseDecimal(row.NET_DEBIT_AMOUNT),
    grossAmount: parseDecimal(row.GROSS_AMOUNT),
    sellerAmount: parseDecimal(row.SELLER_AMOUNT),
    mpFeeAmount: parseDecimal(row.MP_FEE_AMOUNT),
    financingFeeAmount: parseDecimal(row.FINANCING_FEE_AMOUNT),
    shippingFeeAmount: parseDecimal(row.SHIPPING_FEE_AMOUNT),
    taxesAmount: parseDecimal(row.TAXES_AMOUNT),
    couponAmount: parseDecimal(row.COUPON_AMOUNT),
    installments: Number.parseInt(row.INSTALLMENTS || "0", 10) || null,
    paymentMethod: row.PAYMENT_METHOD || null,
    taxDetail: row.TAX_DETAIL || null,
    taxAmountTelco: parseDecimal(row.TAX_AMOUNT_TELCO),
    transactionApprovalDate: parseDate(row.TRANSACTION_APPROVAL_DATE),
    posId: row.POS_ID || null,
    posName: row.POS_NAME || null,
    externalPosId: row.EXTERNAL_POS_ID || null,
    storeId: row.STORE_ID || null,
    storeName: row.STORE_NAME || null,
    externalStoreId: row.EXTERNAL_STORE_ID || null,
    currency: row.CURRENCY || "ARS",
    taxesDisaggregated: parseJson(row.TAXES_DISAGGREGATED) || undefined,
    shippingId: parseBigInt(row.SHIPPING_ID),
    shipmentMode: row.SHIPMENT_MODE || null,
    orderId: parseBigInt(row.ORDER_ID),
    packId: parseBigInt(row.PACK_ID),
    metadata: parseJson(row.METADATA) || undefined,
    effectiveCouponAmount: parseDecimal(row.EFFECTIVE_COUPON_AMOUNT),
    poiId: row.POI_ID || null,
    cardInitialNumber: row.CARD_INITIAL_NUMBER || null,
    operationTags: parseJson(row.OPERATION_TAGS) || undefined,
    itemId: row.ITEM_ID || null,
    poiBankName: row.POI_BANK_NAME || null,
    poiWalletName: row.POI_WALLET_NAME || null,
    businessUnit: row.BUSINESS_UNIT || null,
    subUnit: row.SUB_UNIT || null,
    balanceAmount: parseDecimal(row.BALANCE_AMOUNT),
    payoutBankAccountNumber: row.PAYOUT_BANK_ACCOUNT_NUMBER || null,
    productSku: row.PRODUCT_SKU || null,
    saleDetail: row.SALE_DETAIL || null,
    paymentMethodType: row.PAYMENT_METHOD_TYPE || null,
    transactionIntentId: row.TRANSACTION_INTENT_ID || null,
    franchise: row.FRANCHISE || null,
    issuerName: row.ISSUER_NAME || null,
    lastFourDigits: row.LAST_FOUR_DIGITS || null,
    orderMp: row.ORDER_MP || null,
    purchaseId: row.PURCHASE_ID || null,
    shippingOrderId: row.SHIPPING_ORDER_ID || null,
  };
}
