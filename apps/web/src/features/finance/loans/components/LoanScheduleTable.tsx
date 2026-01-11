import dayjs from "dayjs";

import Button from "@/components/ui/Button";
import { currencyFormatter } from "@/lib/format";

import type { LoanSchedule } from "../types";

interface LoanScheduleTableProps {
  schedules: LoanSchedule[];
  onRegisterPayment: (schedule: LoanSchedule) => void;
  onUnlinkPayment: (schedule: LoanSchedule) => void;
  canManage: boolean;
}

export default function LoanScheduleTable({
  schedules,
  onRegisterPayment,
  onUnlinkPayment,
  canManage,
}: LoanScheduleTableProps) {
  return (
    <div className="border-base-300 bg-base-100 overflow-x-auto rounded-2xl border shadow-sm">
      <table className="table w-full text-sm">
        <thead className="bg-base-200 text-base-content/70 text-xs font-semibold uppercase">
          <tr>
            <th>#</th>
            <th>Vencimiento</th>
            <th className="text-right">Capital</th>
            <th className="text-right">Interés</th>
            <th className="text-right">Cuota</th>
            <th className="text-center">Estado</th>
            <th className="text-right">Pagado</th>
            {canManage && <th className="text-right">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {schedules.map((schedule) => {
            const isLate =
              schedule.status === "OVERDUE" ||
              (schedule.status === "PENDING" && dayjs(schedule.due_date).isBefore(dayjs(), "day"));

            return (
              <tr key={schedule.id} className="hover:bg-base-50 transition-colors">
                <td className="text-base-content/70 font-medium">{schedule.installment_number}</td>
                <td className={isLate ? "font-semibold text-rose-600" : ""}>
                  {dayjs(schedule.due_date).format("DD MMM YYYY")}
                </td>
                <td className="text-right font-mono text-xs opacity-70">
                  {currencyFormatter.format(schedule.expected_principal)}
                </td>
                <td className="text-right font-mono text-xs opacity-70">
                  {currencyFormatter.format(schedule.expected_interest)}
                </td>
                <td className="text-right font-bold">{currencyFormatter.format(schedule.expected_amount)}</td>
                <td className="text-center">
                  {(() => {
                    const badgeClass = (() => {
                      if (schedule.status === "PAID") return "badge-success text-success-content";
                      if (schedule.status === "PARTIAL") return "badge-warning text-warning-content";
                      if (isLate) return "badge-error text-error-content";
                      return "badge-ghost";
                    })();
                    const statusLabel = (() => {
                      if (schedule.status === "PAID") return "Pagado";
                      if (schedule.status === "PARTIAL") return "Parcial";
                      if (isLate) return "Vencido";
                      return "Pendiente";
                    })();
                    return <div className={`badge badge-sm font-semibold capitalize ${badgeClass}`}>{statusLabel}</div>;
                  })()}
                </td>
                <td className="text-right">
                  {schedule.paid_amount ? (
                    <div className="flex flex-col items-end">
                      <span className="text-success font-bold">{currencyFormatter.format(schedule.paid_amount)}</span>
                      {schedule.paid_date && (
                        <span className="text-base-content/50 text-[10px]">
                          {dayjs(schedule.paid_date).format("DD MMM")}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-base-content/30">—</span>
                  )}
                </td>
                {canManage && (
                  <td className="text-right">
                    {schedule.status === "PAID" || schedule.status === "PARTIAL" ? (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => onUnlinkPayment(schedule)}
                        title="Desvincular pago"
                      >
                        Desvincular
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="xs"
                        onClick={() => onRegisterPayment(schedule)}
                        disabled={schedule.loan_id === 0} // Placeholder check
                      >
                        Pagar
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
          {schedules.length === 0 && (
            <tr>
              <td colSpan={canManage ? 8 : 7} className="text-base-content/50 py-8 text-center">
                No hay cronograma disponible.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
