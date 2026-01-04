/**
 * Finance module shared types
 * Common types used across balances, loans, and transactions
 */

/** Standard API response status */
export type ApiStatus = "ok" | "error";

/** Date range for queries */
export type DateRange = {
  from: string;
  to: string;
};

/** Currency amount in CLP (Chilean Pesos) */
export type CurrencyAmount = number;

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
