import { fmtCLP } from "@/lib/format";
import type { Movement } from "@/mp/reports";

interface ReportTableProps {
  ledger: Array<Movement & { runningBalance: number; delta: number }>;
}

function renderDirection(direction: Movement["direction"]) {
  if (direction === "IN") return "Ingreso";
  if (direction === "OUT") return "Egreso";
  return "Neutro";
}

function formatAmount(direction: Movement["direction"], amount: number) {
  const formatted = fmtCLP(amount);
  return direction === "OUT" ? `-${formatted}` : formatted;
}

export default function ReportTable({ ledger }: ReportTableProps) {
  return (
    <div className="overflow-hidden bg-base-100">
      <div className="overflow-x-auto muted-scrollbar">
        <table className="min-w-full text-sm text-slate-600">
          <thead className="bg-base-100/55 text-[var(--brand-primary)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                Fecha
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                Descripción
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                Desde
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                Hacia
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                Tipo
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                Monto
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Saldo cuenta</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((m, i) => (
              <tr key={i} className="border-b border-white/45 bg-base-100/45 last:border-none even:bg-base-100/35">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">{m.timestamp}</td>
                <td className="px-4 py-3">{m.description ?? m.counterparty ?? "-"}</td>
                <td className="px-4 py-3">{m.from ?? "-"}</td>
                <td className="px-4 py-3">{m.to ?? "-"}</td>
                <td className="px-4 py-3">{renderDirection(m.direction)}</td>
                <td
                  className={`px-4 py-3 font-semibold ${
                    m.direction === "IN"
                      ? "text-emerald-600"
                      : m.direction === "OUT"
                        ? "text-rose-600"
                        : "text-slate-600"
                  }`}
                >
                  {formatAmount(m.direction, m.amount)}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-700">{fmtCLP(m.runningBalance)}</td>
              </tr>
            ))}
            {!ledger.length && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  Carga un reporte de saldo para ver los movimientos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
