import type { LedgerRow } from "./types";

export const COLUMN_DEFS = [
  { key: "transactionDate", label: "Fecha" },
  { key: "transactionAmount", label: "Monto" },
  { key: "transactionTransactionType", label: "Tipo Transacción" }, // Remapped in table or use key matching type
  { key: "transactionType", label: "Tipo" },
  { key: "status", label: "Estado" },
  { key: "description", label: "Descripción" },
  { key: "externalReference", label: "Ref. Externa" },
  { key: "paymentMethod", label: "Medio Pago" },
  { key: "paymentMethodType", label: "Tipo Medio Pago" },
  { key: "installments", label: "Cuotas" },
  { key: "settlementNetAmount", label: "Monto Neto" },
  { key: "feeAmount", label: "Comisión" },
  { key: "taxesAmount", label: "Impuestos" },
  { key: "couponAmount", label: "Cupón" },
  { key: "shippingFeeAmount", label: "Envío" },
  { key: "financingFeeAmount", label: "Financiamiento" },
  { key: "transactionCurrency", label: "Moneda" },
  { key: "moneyReleaseDate", label: "Fecha Liberación" },
  { key: "settlementDate", label: "Fecha Liquidación" },
  { key: "isReleased", label: "Liberado" },
  { key: "sourceId", label: "Source ID" },
  { key: "orderMp", label: "Orden MP" },
  { key: "orderId", label: "Order ID" },
  { key: "runningBalance", label: "Saldo Acumulado" },
  // Extra IDs
  { key: "posId", label: "POS ID" },
  { key: "storeId", label: "Store ID" },
  { key: "userId", label: "User ID" },
  { key: "site", label: "Site" },
  // Details
  { key: "cardInitialNumber", label: "BIN Tarjeta" },
  { key: "lastFourDigits", label: "Últimos 4" },
  { key: "issuerName", label: "Emisor" },
  { key: "businessUnit", label: "Unidad Negocio" },
  // Additional amount fields
  { key: "totalCouponAmount", label: "Total Cupón" },
  { key: "sellerAmount", label: "Monto Vendedor" },
  { key: "mkpFeeAmount", label: "Comisión MP" },
  { key: "tipAmount", label: "Propina" },
  { key: "realAmount", label: "Monto Real" },
] as const;

export type ColumnKey = (typeof COLUMN_DEFS)[number]["key"];

export type TransactionsTableRow = LedgerRow;
