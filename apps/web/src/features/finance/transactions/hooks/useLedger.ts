import { coerceAmount } from "@/lib/format";

import type { LedgerRow, Transaction } from "../types";

interface UseLedgerProps {
  rows: Transaction[];
  initialBalance: string;
  hasAmounts: boolean;
}

export function useLedger({ rows, initialBalance, hasAmounts }: UseLedgerProps): LedgerRow[] {
  const initialBalanceNumber = coerceAmount(initialBalance);

  const sorted = rows.slice().sort((a, b) => {
    if (a.transactionDate === b.transactionDate) return 0;
    return a.transactionDate > b.transactionDate ? 1 : -1;
  });

  let balance = initialBalanceNumber;
  const result: LedgerRow[] = [];

  for (const row of sorted) {
    const amount = row.transactionAmount ?? 0;
    const delta = amount;
    if (hasAmounts) {
      balance += delta;
    }
    result.push({
      ...row,
      runningBalance: hasAmounts ? balance : 0,
      delta,
    });
  }

  return result.reverse();
}
