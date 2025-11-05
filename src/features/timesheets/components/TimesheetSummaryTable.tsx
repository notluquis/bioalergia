import dayjs from "dayjs";
import { memo } from "react";
import { fmtCLP } from "../../../lib/format";
import type { TimesheetSummaryRow } from "../types";

interface TimesheetSummaryTableProps {
  summary: { employees: TimesheetSummaryRow[]; totals: SummaryTotals } | null;
  loading: boolean;
  selectedEmployeeId: number | null;
  onSelectEmployee: (id: number) => void;
}

type SummaryTotals = {
  hours: string;
  overtime: string;
  extraAmount: number;
  subtotal: number;
  retention: number;
  net: number;
};

const TimesheetSummaryTable = memo(function TimesheetSummaryTable({
  summary,
  loading,
  selectedEmployeeId,
  onSelectEmployee,
}: TimesheetSummaryTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-primary/15 bg-base-100 shadow-sm">
      <div className="overflow-x-auto muted-scrollbar">
        <table className="min-w-full text-sm">
          <thead className="bg-primary/10 text-primary">
            <tr>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Trabajador</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Función</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Horas trabajadas</th>
              {/* Horas extra duplicaba "Extras"; se elimina */}
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Tarifa</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Extras</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Subtotal</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Retención</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Líquido</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Fecha pago</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-primary">
                  Cargando resumen...
                </td>
              </tr>
            )}
            {!loading &&
              summary?.employees.map((row) => (
                <tr
                  key={row.employeeId}
                  role="button"
                  tabIndex={0}
                  className={`cursor-pointer odd:bg-base-200/60 hover:bg-primary/5 transition-colors will-change-auto ${
                    row.employeeId === selectedEmployeeId ? "bg-primary/10 outline-2 outline-primary/30" : ""
                  }`}
                  onClick={() => onSelectEmployee(row.employeeId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectEmployee(row.employeeId);
                    }
                  }}
                >
                  <td className="px-4 py-3 font-medium text-base-content">{row.fullName}</td>
                  <td className="px-4 py-3 text-base-content/60">{row.role}</td>
                  <td className="px-4 py-3 text-base-content">{row.hoursFormatted}</td>
                  <td className="px-4 py-3 text-base-content">{fmtCLP(row.hourlyRate)}</td>
                  {/* Extras deben venir del detalle (overtime) */}
                  <td className="px-4 py-3 text-base-content">{row.overtimeFormatted}</td>
                  <td className="px-4 py-3 text-base-content">{fmtCLP(row.subtotal)}</td>
                  <td className="px-4 py-3 text-base-content">{fmtCLP(row.retention)}</td>
                  <td className="px-4 py-3 text-base-content">{fmtCLP(row.net)}</td>
                  <td className="px-4 py-3 text-base-content">{dayjs(row.payDate).format("DD-MM-YYYY")}</td>
                </tr>
              ))}
            {!loading && summary?.employees.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-base-content/60">
                  Aún no registras horas en este periodo.
                </td>
              </tr>
            )}
          </tbody>
          {summary && (
            <tfoot className="bg-base-200 text-base-content">
              <tr>
                <td className="px-4 py-3 font-semibold" colSpan={2}>
                  TOTAL
                </td>
                <td className="px-4 py-3 font-semibold">{summary.totals.hours}</td>
                {/* Extras totales desde detalle (overtime) */}
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 font-semibold">{summary.totals.overtime}</td>
                <td className="px-4 py-3 font-semibold">{fmtCLP(summary.totals.subtotal)}</td>
                <td className="px-4 py-3 font-semibold">{fmtCLP(summary.totals.retention)}</td>
                <td className="px-4 py-3 font-semibold">{fmtCLP(summary.totals.net)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
});

export default TimesheetSummaryTable;
