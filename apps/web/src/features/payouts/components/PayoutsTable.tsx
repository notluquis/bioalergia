import type { ReleaseTransaction } from "@finanzas/db/models";
import dayjs from "dayjs";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";

import { fmtCLP } from "@/lib/format";

interface PayoutsTableProps {
  payouts: ReleaseTransaction[];
  isLoading: boolean;
}

export function PayoutsTable({ payouts, isLoading }: PayoutsTableProps) {
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (payouts.length === 0) {
    return (
      <div className="text-base-content/50 flex h-64 flex-col items-center justify-center">
        <Wallet className="mb-2 h-10 w-10 opacity-20" />
        <p>No se encontraron retiros.</p>
      </div>
    );
  }

  return (
    <div className="rounded-box border-base-200 bg-base-100 overflow-x-auto border shadow-sm">
      <table className="table-zebra table-sm table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Referencia</th>
            <th>Descripción</th>
            <th className="text-right">Monto Bruto</th>
            <th className="text-right">Débito Neto</th>
            <th className="text-right">Crédito Neto</th>
            <th className="text-right">Balance</th>
            <th>Cuenta Destino</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((payout) => (
            <tr key={payout.id} className="hover">
              <td className="text-base-content font-medium whitespace-nowrap">
                {dayjs(payout.date).format("DD MMM YYYY HH:mm")}
              </td>
              <td className="text-base-content/70 font-mono text-xs">{payout.externalReference || "-"}</td>
              <td>
                <div className="flex items-center gap-2">
                  <span className="badge badge-sm badge-ghost">{payout.description}</span>
                </div>
              </td>
              <td className="text-right font-medium">{fmtCLP(String(payout.grossAmount))}</td>
              <td className="text-error text-right font-medium">
                {payout.netDebitAmount ? (
                  <span className="flex items-center justify-end gap-1">
                    {fmtCLP(String(payout.netDebitAmount))}
                    <ArrowDownLeft className="h-3 w-3" />
                  </span>
                ) : (
                  "-"
                )}
              </td>
              <td className="text-success text-right font-medium">
                {payout.netCreditAmount ? (
                  <span className="flex items-center justify-end gap-1">
                    {fmtCLP(String(payout.netCreditAmount))}
                    <ArrowUpRight className="h-3 w-3" />
                  </span>
                ) : (
                  "-"
                )}
              </td>
              <td className="text-base-content text-right font-bold">
                {payout.balanceAmount ? fmtCLP(String(payout.balanceAmount)) : "-"}
              </td>
              <td className="text-base-content/70 font-mono text-xs">{payout.payoutBankAccountNumber || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
