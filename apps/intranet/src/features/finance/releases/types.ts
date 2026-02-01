import type { JsonId } from "../types";

export interface ListResponse {
  data: ReleaseTransaction[];
  page: number;
  pageSize: number;
  status: "ok";
  total: number;
  totalPages: number;
}

export interface ReleaseTransaction {
  balanceAmount: DecimalValue;
  businessUnit: null | string;
  cardInitialNumber: null | string;
  couponAmount: DecimalValue;
  currency: null | string;
  date: string;
  description: null | string;
  effectiveCouponAmount: DecimalValue;
  externalPosId: null | string;
  externalReference: null | string;
  externalStoreId: null | string;
  financingFeeAmount: DecimalValue;
  franchise: null | string;
  grossAmount: DecimalValue;
  id: number;
  installments: null | number;
  issuerName: null | string;
  itemId: null | string;
  lastFourDigits: null | string;
  mpFeeAmount: DecimalValue;
  netCreditAmount: DecimalValue;
  netDebitAmount: DecimalValue;
  operationTags: unknown;
  orderId: JsonId | null;
  orderMp: null | string;
  packId: JsonId | null;
  paymentMethod: null | string;
  paymentMethodType: null | string;
  payoutBankAccountNumber: null | string;
  poiBankName: null | string;
  poiId: null | string;
  poiWalletName: null | string;
  posId: null | string;
  posName: null | string;
  productSku: null | string;
  purchaseId: null | string;
  recordType: null | string;
  saleDetail: null | string;
  sellerAmount: DecimalValue;
  shipmentMode: null | string;
  shippingFeeAmount: DecimalValue;
  shippingId: JsonId | null;
  shippingOrderId: null | string;
  sourceId: string;
  storeId: null | string;
  storeName: null | string;
  subUnit: null | string;
  taxAmountTelco: DecimalValue;
  taxDetail: null | string;
  taxesAmount: DecimalValue;
  taxesDisaggregated: unknown;
  transactionApprovalDate: null | string;
  transactionIntentId: null | string;
}

// Prisma/ZenStack serializes Decimal as string in JSON
type DecimalValue = null | number | string;
