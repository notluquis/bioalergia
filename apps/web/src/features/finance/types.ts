/**
 * Finance module shared types
 * Common types used across balances, loans, and transactions
 */

/** Standard API response status */
export type ApiStatus = "error" | "ok";

/** Date range for queries */
export interface DateRange {
  from: string;
  to: string;
}

/** Entity type for borrowers */
export type EntityType = "COMPANY" | "PERSON";

/** Interest calculation type */
export type InterestType = "COMPOUND" | "SIMPLE";

/** ID type for JSON responses (can be string, number or bigint) */
export type JsonId = bigint | number | string;

/** Loan status */
export type LoanStatus = "ACTIVE" | "COMPLETED" | "DEFAULTED";

/** Direction of money flow */
export type MoneyDirection = "IN" | "NEUTRO" | "OUT";

/** Payment frequency */
export type PaymentFrequency = "BIWEEKLY" | "MONTHLY" | "WEEKLY";

/** Common loan/schedule status */
export type PaymentStatus = "OVERDUE" | "PAID" | "PARTIAL" | "PENDING" | "SKIPPED";

/** Transaction movement from DB (mapped) */
export interface Transaction {
  description: null | string;
  externalReference: null | string;
  id: number;
  paymentMethod: null | string;
  settlementNetAmount: null | number;
  sourceId: null | string;
  status: null | string;
  transactionAmount: null | number;
  transactionDate: string;
  transactionType: string;
}
