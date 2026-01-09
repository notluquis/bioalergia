import { SettlementTransaction, ReleaseTransaction } from "@finanzas/db";

// Helper parsers
export function parseDate(val: string) {
  if (!val) return new Date();
  return new Date(val);
}

export function parseDecimal(val: string): any {
  if (!val) return 0;
  return val.replace(",", ".");
}

export function parseBigInt(val: string) {
  if (!val) return null;
  try {
    return BigInt(val);
  } catch {
    return null;
  }
}

export function parseJson(val: any) {
  if (!val) return null;
  try {
    if (typeof val === "string") return JSON.parse(val);
    return val;
  } catch {
    return val; // Return raw string if not JSON
  }
}

// Mapper for Settlement Report
export function mapRowToSettlementTransaction(
  row: any
): Partial<SettlementTransaction> {
  return {
    sourceId: row.SOURCE_ID,
    transactionDate: parseDate(row.TRANSACTION_DATE),
    settlementDate: parseDate(row.SETTLEMENT_DATE),
    moneyReleaseDate: parseDate(row.MONEY_RELEASE_DATE),
    externalReference: row.EXTERNAL_REFERENCE,
    userId: row.USER_ID,
    paymentMethodType: row.PAYMENT_METHOD_TYPE,
    paymentMethod: row.PAYMENT_METHOD,
    site: row.SITE,
    transactionType: row.TRANSACTION_TYPE,
    transactionAmount: parseDecimal(row.TRANSACTION_AMOUNT),
    transactionCurrency: row.TRANSACTION_CURRENCY,
    sellerAmount: parseDecimal(row.SELLER_AMOUNT),
    feeAmount: parseDecimal(row.FEE_AMOUNT),
    settlementNetAmount: parseDecimal(row.SETTLEMENT_NET_AMOUNT),
    settlementCurrency: row.SETTLEMENT_CURRENCY,
    realAmount: parseDecimal(row.REAL_AMOUNT),
    couponAmount: parseDecimal(row.COUPON_AMOUNT),
    metadata: parseJson(row.METADATA),
    mkpFeeAmount: parseDecimal(row.MKP_FEE_AMOUNT),
    financingFeeAmount: parseDecimal(row.FINANCING_FEE_AMOUNT),
    shippingFeeAmount: parseDecimal(row.SHIPPING_FEE_AMOUNT),
    taxesAmount: parseDecimal(row.TAXES_AMOUNT),
    installments: parseInt(row.INSTALLMENTS || "0") || null,
    taxDetail: row.TAX_DETAIL,
    taxesDisaggregated: parseJson(row.TAXES_DISAGGREGATED),
    description: row.DESCRIPTION,
    cardInitialNumber: row.CARD_INITIAL_NUMBER,
    operationTags: parseJson(row.OPERATION_TAGS),
    businessUnit: row.BUSINESS_UNIT,
    subUnit: row.SUB_UNIT,
    productSku: row.PRODUCT_SKU,
    saleDetail: row.SALE_DETAIL,
    transactionIntentId: row.TRANSACTION_INTENT_ID,
    franchise: row.FRANCHISE,
    issuerName: row.ISSUER_NAME,
    lastFourDigits: row.LAST_FOUR_DIGITS,
    orderMp: row.ORDER_MP,
    invoicingPeriod: row.INVOICING_PERIOD,
    payBankTransferId: row.PAY_BANK_TRANSFER_ID,
    isReleased: String(row.IS_RELEASED).toUpperCase() === "TRUE",
    tipAmount: parseDecimal(row.TIP_AMOUNT),
    purchaseId: row.PURCHASE_ID,
    totalCouponAmount: parseDecimal(row.TOTAL_COUPON_AMOUNT),
    posId: row.POS_ID,
    posName: row.POS_NAME,
    externalPosId: row.EXTERNAL_POS_ID,
    storeId: row.STORE_ID,
    storeName: row.STORE_NAME,
    externalStoreId: row.EXTERNAL_STORE_ID,
    poiId: row.POI_ID,
    orderId: parseBigInt(row.ORDER_ID),
    shippingId: parseBigInt(row.SHIPPING_ID),
    shipmentMode: row.SHIPMENT_MODE,
    packId: parseBigInt(row.PACK_ID),
    shippingOrderId: row.SHIPPING_ORDER_ID,
    poiWalletName: row.POI_WALLET_NAME,
    poiBankName: row.POI_BANK_NAME,
  };
}

// Mapper for Release Report
export function mapRowToReleaseTransaction(
  row: any
): Partial<ReleaseTransaction> {
  return {
    sourceId: row.SOURCE_ID,
    date: parseDate(row.DATE),
    externalReference: row.EXTERNAL_REFERENCE,
    recordType: row.RECORD_TYPE,
    description: row.DESCRIPTION,
    netCreditAmount: parseDecimal(row.NET_CREDIT_AMOUNT),
    netDebitAmount: parseDecimal(row.NET_DEBIT_AMOUNT),
    grossAmount: parseDecimal(row.GROSS_AMOUNT),
    sellerAmount: parseDecimal(row.SELLER_AMOUNT),
    mpFeeAmount: parseDecimal(row.MP_FEE_AMOUNT),
    financingFeeAmount: parseDecimal(row.FINANCING_FEE_AMOUNT),
    shippingFeeAmount: parseDecimal(row.SHIPPING_FEE_AMOUNT),
    taxesAmount: parseDecimal(row.TAXES_AMOUNT),
    couponAmount: parseDecimal(row.COUPON_AMOUNT),
    installments: parseInt(row.INSTALLMENTS || "0") || null,
    paymentMethod: row.PAYMENT_METHOD,
    taxDetail: row.TAX_DETAIL,
    taxAmountTelco: parseDecimal(row.TAX_AMOUNT_TELCO),
    transactionApprovalDate: parseDate(row.TRANSACTION_APPROVAL_DATE),
    posId: row.POS_ID,
    posName: row.POS_NAME,
    externalPosId: row.EXTERNAL_POS_ID,
    storeId: row.STORE_ID,
    storeName: row.STORE_NAME,
    externalStoreId: row.EXTERNAL_STORE_ID,
    currency: row.CURRENCY,
    taxesDisaggregated: parseJson(row.TAXES_DISAGGREGATED),
    shippingId: parseBigInt(row.SHIPPING_ID),
    shipmentMode: row.SHIPMENT_MODE,
    orderId: parseBigInt(row.ORDER_ID),
    packId: parseBigInt(row.PACK_ID),
    metadata: parseJson(row.METADATA),
    effectiveCouponAmount: parseDecimal(row.EFFECTIVE_COUPON_AMOUNT),
    poiId: row.POI_ID,
    cardInitialNumber: row.CARD_INITIAL_NUMBER,
    operationTags: parseJson(row.OPERATION_TAGS),
    itemId: row.ITEM_ID,
    poiBankName: row.POI_BANK_NAME,
    poiWalletName: row.POI_WALLET_NAME,
    businessUnit: row.BUSINESS_UNIT,
    subUnit: row.SUB_UNIT,
    balanceAmount: parseDecimal(row.BALANCE_AMOUNT),
    payoutBankAccountNumber: row.PAYOUT_BANK_ACCOUNT_NUMBER,
    productSku: row.PRODUCT_SKU,
    saleDetail: row.SALE_DETAIL,
    paymentMethodType: row.PAYMENT_METHOD_TYPE,
    transactionIntentId: row.TRANSACTION_INTENT_ID,
    franchise: row.FRANCHISE,
    issuerName: row.ISSUER_NAME,
    lastFourDigits: row.LAST_FOUR_DIGITS,
    orderMp: row.ORDER_MP,
    purchaseId: row.PURCHASE_ID,
    shippingOrderId: row.SHIPPING_ORDER_ID,
  };
}
