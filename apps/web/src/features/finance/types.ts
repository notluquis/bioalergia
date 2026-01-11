/**
 * Finance module shared types
 * Common types used across balances, loans, and transactions
 */

/** Standard API response status */
export type ApiStatus = "ok" | "error";

/** ID type for JSON responses (can be string, number or bigint) */
export type JsonId = string | number | bigint;

/** Date range for queries */
export type DateRange = {
  from: string;
  to: string;
};

/** Direction of money flow */
export type MoneyDirection = "IN" | "OUT" | "NEUTRO";

/** Common loan/schedule status */
export type PaymentStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "SKIPPED";

/** Loan status */
export type LoanStatus = "ACTIVE" | "COMPLETED" | "DEFAULTED";

/** Payment frequency */
export type PaymentFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

/** Interest calculation type */
export type InterestType = "SIMPLE" | "COMPOUND";

/** Entity type for borrowers */
export type EntityType = "PERSON" | "COMPANY";

/** Transaction movement from DB (mapped) */
export type Transaction = {
  id: number;
  transactionDate: string;
  description: string | null;
  transactionType: string;
  transactionAmount: number | null;
  status: string | null;
  externalReference: string | null;
  sourceId: string | null;
  paymentMethod: string | null;
  settlementNetAmount: number | null;
};
