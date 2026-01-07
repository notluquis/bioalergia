// New Transaction Type matching Prisma Model
export type Transaction = {
  id: number;
  transactionDate: string;
  settlementDate: string | null;
  moneyReleaseDate: string | null;
  externalReference: string | null;
  sourceId: string | null;
  userId: string | null;
  site: string | null;
  transactionAmount: number; // Signed amount
  transactionCurrency: string;
  feeAmount: number | null;
  settlementNetAmount: number | null;
  settlementCurrency: string | null;
  realAmount: number | null;
  couponAmount: number | null;
  totalCouponAmount: number | null;
  sellerAmount: number | null;
  mkpFeeAmount: number | null;
  financingFeeAmount: number | null;
  shippingFeeAmount: number | null;
  taxesAmount: number | null;
  tipAmount: number | null;
  transactionType: string;
  paymentMethodType: string | null;
  paymentMethod: string | null;
  status: string | null;
  isReleased: boolean | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  taxDetail: string | null;
  taxesDisaggregated: Record<string, unknown> | null;
  operationTags: Record<string, unknown> | null;
  installments: number | null;
  cardInitialNumber: string | null;
  lastFourDigits: string | null;
  franchise: string | null;
  issuerName: string | null;
  businessUnit: string | null;
  subUnit: string | null;
  productSku: string | null;
  saleDetail: string | null;
  transactionIntentId: string | null;
  orderMp: string | null;
  purchaseId: string | null;
  payBankTransferId: string | null;
  shippingOrderId: string | null;
  invoicingPeriod: string | null;
  posId: string | null;
  storeId: string | null;
  storeName: string | null;
  externalPosId: string | null;
  posName: string | null;
  externalStoreId: string | null;
  poiId: string | null;
  shippingId: number | null;
  shipmentMode: string | null;
  orderId: number | null;
  packId: number | null;
  poiWalletName: string | null;
  poiBankName: string | null;
};

// Legacy alias to ease refactoring, but mapped to new type
export type DbMovement = Transaction;

export type LedgerRow = Transaction & { runningBalance: number; delta: number };

export type Filters = {
  from: string;
  to: string;
  description: string;
  sourceId: string;
  externalReference: string;
  status: string;
  transactionType: string;
  bankAccountNumber: string; // Maybe obsolete but kept for now
  origin: string; // Maybe obsolete
  destination: string; // Maybe obsolete
  direction: "" | "IN" | "OUT"; // Kept for UI compatibility, but functionality might be limited
  includeAmounts: boolean;
  includeTest?: boolean; // Exclude test transactions by default
};

export type ApiResponse = {
  status: "ok" | "error";
  data: Transaction[];
  hasAmounts?: boolean;
  total?: number;
  page?: number;
  pageSize?: number;
  message?: string;
};
