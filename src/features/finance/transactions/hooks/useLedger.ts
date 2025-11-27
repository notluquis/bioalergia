import { useMemo } from "react";
import { isCashbackCandidate } from "~/shared/cashback";
import type { DbMovement, LedgerRow } from "../types";
import { coerceAmount } from "@/lib/format";

interface UseLedgerProps {
  rows: DbMovement[];
  initialBalance: string;
  hasAmounts: boolean;
}

export function useLedger({ rows, initialBalance, hasAmounts }: UseLedgerProps): LedgerRow[] {
  const initialBalanceNumber = useMemo(() => coerceAmount(initialBalance), [initialBalance]);

  const ledger = useMemo<LedgerRow[]>(() => {
    let balance = initialBalanceNumber;
    const chronological = rows
      .slice()
      .sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1))
      .map((row) => {
        const amount = row.amount ?? 0;
        const delta = isCashbackCandidate(row)
          ? 0
          : row.direction === "IN"
            ? amount
            : row.direction === "OUT"
              ? -amount
              : 0;
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
