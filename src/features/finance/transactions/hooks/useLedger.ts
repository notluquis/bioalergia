import { useMemo } from "react";

import { coerceAmount } from "@/lib/format";

import type { LedgerRow, Transaction } from "../types";

interface UseLedgerProps {
  rows: Transaction[];
  initialBalance: string;
  hasAmounts: boolean;
}

export function useLedger({ rows, initialBalance, hasAmounts }: UseLedgerProps): LedgerRow[] {
  const initialBalanceNumber = useMemo(() => coerceAmount(initialBalance), [initialBalance]);

  const ledger = useMemo<LedgerRow[]>(() => {
    let balance = initialBalanceNumber;
    const chronological = rows
      .slice()
      .sort((a, b) => (new Date(a.transactionDate).getTime() > new Date(b.transactionDate).getTime() ? 1 : -1))
      .map((row) => {
        // transactionAmount is signed: positive = income, negative = expense
        const amount = row.transactionAmount ?? 0;
        const delta = amount;
        if (hasAmounts) {
          balance += delta;
        }
        return {
          ...row,
          runningBalance: hasAmounts ? balance : 0,
          delta,
        };
      });

    return chronological.reverse();
  }, [rows, initialBalanceNumber, hasAmounts]);

  return ledger;
}
