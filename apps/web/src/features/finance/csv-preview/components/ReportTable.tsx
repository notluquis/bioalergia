/**
 * Report Table Component
 * Displays CSV preview with running balance
 */

import { fmtCLP } from "@/lib/format";

import type { LedgerRow } from "../types";

interface ReportTableProps {
  ledger: LedgerRow[];
}

function renderDirection(direction: "IN" | "OUT" | "NEUTRO") {
  if (direction === "IN") return "Ingreso";
  if (direction === "OUT") return "Egreso";
  return "Neutro";
}

function formatAmount(direction: "IN" | "OUT" | "NEUTRO", amount: number) {
  const formatted = fmtCLP(amount);
  return direction === "OUT" ? `-${formatted}` : formatted;
}

export default function ReportTable({ ledger }: ReportTableProps) {
  return (
    <div className="bg-base-100 border-base-200 overflow-hidden rounded-2xl border shadow-sm">
      <div className="overflow-x-auto">
        <table className="table-sm table">
          <thead className="bg-base-200 text-base-content">
            <tr>
              <th className="whitespace-nowrap">Fecha</th>
              <th className="whitespace-nowrap">Descripción</th>
              <th className="whitespace-nowrap">Desde</th>
              <th className="whitespace-nowrap">Hacia</th>
              <th className="whitespace-nowrap">Tipo</th>
              <th className="text-right whitespace-nowrap">Monto</th>
              <th className="text-right whitespace-nowrap">Saldo cuenta</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((m, i) => (
              <tr key={i} className="hover:bg-base-200/50">
                <td className="font-medium whitespace-nowrap">{m.timestamp}</td>
                <td className="max-w-xs truncate">{m.description ?? m.counterparty ?? "-"}</td>
                <td className="truncate">{m.from ?? "-"}</td>
                <td className="truncate">{m.to ?? "-"}</td>
                <td>{renderDirection(m.direction)}</td>
                <td
                  className={`text-right font-semibold ${
                    m.direction === "IN" ? "text-success" : m.direction === "OUT" ? "text-error" : "text-base-content"
                  }`}
                >
                  {formatAmount(m.direction, m.amount)}
                </td>
                <td className="text-right font-mono font-semibold">{fmtCLP(m.runningBalance)}</td>
              </tr>
            ))}
            {!ledger.length && (
              <tr>
                <td colSpan={7} className="text-base-content/60 py-8 text-center">
                  Carga un reporte de saldo para ver los movimientos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {ledger.length > 0 && (
        <div className="bg-base-200/50 border-base-200 flex items-center justify-between border-t px-4 py-3 text-sm">
          <span className="text-base-content/70">
            Total: <strong className="text-base-content">{ledger.length}</strong> movimientos
          </span>
          <span className="text-base-content/70">
            Saldo final:{" "}
            <strong className="text-base-content font-mono">
              {fmtCLP(ledger[ledger.length - 1]?.runningBalance ?? 0)}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
}
