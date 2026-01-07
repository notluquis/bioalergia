/**
 * CSV Preview Types
 */

export interface Movement {
  timestamp: string;
  description: string | null;
  counterparty: string | null;
  from: string | null;
  to: string | null;
  direction: "IN" | "OUT" | "NEUTRO";
  amount: number;
}

export interface LedgerRow extends Movement {
  runningBalance: number;
  delta: number;
}
