import dayjs from "dayjs";
import Button from "../../../components/Button";
import type { LoanSchedule } from "../types";

interface LoanScheduleTableProps {
  schedules: LoanSchedule[];
  onRegisterPayment: (schedule: LoanSchedule) => void;
  onUnlinkPayment: (schedule: LoanSchedule) => void;
  canManage: boolean;
}

function statusBadge(status: LoanSchedule["status"], dueDate: string) {
  const today = dayjs().startOf("day");
  const due = dayjs(dueDate);
  const isPastDue = due.isBefore(today) && (status === "PENDING" || status === "PARTIAL");
  switch (status) {
    case "PAID":
      return "bg-success/20 text-success";
    case "PARTIAL":
      return "bg-warning/20 text-warning";
    case "OVERDUE":
      return "bg-error/20 text-error";
    default:
      return isPastDue ? "bg-error/20 text-error" : "bg-base-200 text-base-content/60";
  }
}

export function LoanScheduleTable({
  schedules,
  onRegisterPayment,
  onUnlinkPayment,
  canManage,
}: LoanScheduleTableProps) {
  return (
    <div className="overflow-hidden bg-base-100">
      <div className="overflow-x-auto muted-scrollbar">
        <table className="min-w-full text-sm text-base-content">
          <thead className="bg-base-100/60 text-primary">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                Cuota
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                Vencimiento
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                Monto
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                Estado
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                Pago
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Transacción</th>
              {canManage && (
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Acciones</th>
              )}
            </tr>
          </thead>
          <tbody>
            {schedules.map((schedule) => {
              const badgeClass = statusBadge(schedule.status, schedule.due_date);
              const paidInfo = schedule.paid_amount != null ? `$${schedule.paid_amount.toLocaleString("es-CL")}` : "—";
              const paidDate = schedule.paid_date ? dayjs(schedule.paid_date).format("DD MMM YYYY") : "—";
              return (
                <tr
                  key={schedule.id}
                  className="border-b border-base-300 bg-base-200 last:border-none even:bg-base-300"
                >
                  <td className="px-4 py-3 font-semibold text-base-content">#{schedule.installment_number}</td>
                  <td className="px-4 py-3 text-base-content">{dayjs(schedule.due_date).format("DD MMM YYYY")}</td>
                  <td className="px-4 py-3 text-base-content">${schedule.expected_amount.toLocaleString("es-CL")}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${badgeClass}`}
                    >
                      {schedule.status === "PENDING"
                        ? "Pendiente"
                        : schedule.status === "PAID"
                          ? "Pagado"
                          : schedule.status === "PARTIAL"
                            ? "Parcial"
                            : "Vencido"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-base-content">
                    <div className="space-y-1">
                      <div>{paidInfo}</div>
                      <div className="text-xs text-base-content/50">{paidDate}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-base-content">
                    {schedule.transaction ? (
                      <div className="space-y-1">
                        <div className="font-medium">ID #{schedule.transaction.id}</div>
                        <div className="text-xs text-base-content/50">
                          {schedule.transaction.description ?? "(sin descripción)"}
                        </div>
                      </div>
                    ) : (
                      <span className="text-base-content/50">Sin vincular</span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-base-content">
                      <div className="flex flex-wrap gap-2">
                        {(schedule.status === "PENDING" ||
                          schedule.status === "PARTIAL" ||
                          schedule.status === "OVERDUE") && (
                          <Button type="button" size="xs" onClick={() => onRegisterPayment(schedule)}>
                            Registrar pago
                          </Button>
                        )}
                        {schedule.transaction && (
                          <Button type="button" variant="secondary" size="xs" onClick={() => onUnlinkPayment(schedule)}>
                            Desvincular
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {!schedules.length && (
              <tr>
                <td colSpan={canManage ? 7 : 6} className="px-4 py-6 text-center text-base-content/60">
                  Este préstamo aún no tiene cronograma generado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default LoanScheduleTable;
