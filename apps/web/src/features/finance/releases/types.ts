import type { JsonId } from "../types";

export interface ReleaseTransaction {
  id: number;
  sourceId: string;
  date: string;
  externalReference: string | null;
  recordType: string | null;
  description: string | null;
  netCreditAmount: number | null;
  netDebitAmount: number | null;
  grossAmount: number | null;
  sellerAmount: number | null;
  mpFeeAmount: number | null;
  financingFeeAmount: number | null;
  shippingFeeAmount: number | null;
  taxesAmount: number | null;
  couponAmount: number | null;
  effectiveCouponAmount: number | null;
  balanceAmount: number | null;
  taxAmountTelco: number | null;
  installments: number | null;
  paymentMethod: string | null;
  paymentMethodType: string | null;
  taxDetail: string | null;
  taxesDisaggregated: unknown;
  posId: string | null;
  posName: string | null;
  storeId: string | null;
  storeName: string | null;
  orderId: JsonId | null;
  currency: string | null;
  shippingId: JsonId | null;
  shipmentMode: string | null;
  transactionApprovalDate: string | null;
  transactionIntentId: string | null;
  externalPosId: string | null;
  externalStoreId: string | null;
  shippingOrderId: string | null;
  packId: JsonId | null;
  poiId: string | null;
  itemId: string | null;
  cardInitialNumber: string | null;
  operationTags: unknown;
  lastFourDigits: string | null;
  franchise: string | null;
  issuerName: string | null;
  poiBankName: string | null;
  poiWalletName: string | null;
  businessUnit: string | null;
  subUnit: string | null;
  payoutBankAccountNumber: string | null;
  productSku: string | null;
  saleDetail: string | null;
  orderMp: string | null;
  purchaseId: string | null;
}

export interface ListResponse {
  status: string;
  data: ReleaseTransaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
