import type { Transaction } from "@finanzas/db";

// Transaction mapper type - expects Transaction or transaction-like row
type TransactionRow = Pick<
  Transaction,
  | "id"
  | "transactionDate"
  | "description"
  | "transactionType"
  | "transactionAmount"
  | "status"
  | "externalReference"
  | "sourceId"
  | "paymentMethod"
  | "settlementNetAmount"
>;

export function mapTransaction(row: TransactionRow) {
  return {
    id: Number(row.id),
    transactionDate: row.transactionDate,
    description: row.description,
    transactionType: row.transactionType,
    transactionAmount: row.transactionAmount != null ? Number(row.transactionAmount) : null,
    status: row.status,
    externalReference: row.externalReference,
    sourceId: row.sourceId,
    paymentMethod: row.paymentMethod,
    settlementNetAmount: row.settlementNetAmount != null ? Number(row.settlementNetAmount) : null,
  };
}
