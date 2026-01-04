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
    <div className="bg-base-100 overflow-hidden">
      <div className="muted-scrollbar overflow-x-auto">
        <table className="text-base-content min-w-full text-sm">
          <thead className="bg-base-100/55 text-primary">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap uppercase">
                Fecha
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap uppercase">
                Descripción
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap uppercase">
                Desde
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap uppercase">
                Hacia
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap uppercase">
                Tipo
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap uppercase">
                Monto
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">Saldo cuenta</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((m, i) => (
              <tr key={i} className="border-base-300 bg-base-100/45 even:bg-base-100/35 border-b last:border-none">
                <td className="text-base-content px-4 py-3 font-medium whitespace-nowrap">{m.timestamp}</td>
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
                        : "text-base-content"
                  }`}
                >
                  {formatAmount(m.direction, m.amount)}
                </td>
                <td className="text-base-content px-4 py-3 font-semibold">{fmtCLP(m.runningBalance)}</td>
              </tr>
            ))}
            {!ledger.length && (
              <tr>
                <td colSpan={7} className="text-base-content/60 px-4 py-6 text-center">
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
