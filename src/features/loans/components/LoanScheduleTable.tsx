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
      return "bg-emerald-100 text-emerald-700";
    case "PARTIAL":
      return "bg-amber-100 text-amber-700";
    case "OVERDUE":
      return "bg-rose-100 text-rose-700";
    default:
      return isPastDue ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600";
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
        <table className="min-w-full text-sm text-slate-600">
          <thead className="bg-base-100/60 text-(--brand-primary)">
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
                  className="border-b border-white/45 bg-base-100/45 last:border-none even:bg-base-100/35"
                >
                  <td className="px-4 py-3 font-semibold text-slate-700">#{schedule.installment_number}</td>
                  <td className="px-4 py-3 text-slate-600">{dayjs(schedule.due_date).format("DD MMM YYYY")}</td>
                  <td className="px-4 py-3 text-slate-600">${schedule.expected_amount.toLocaleString("es-CL")}</td>
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
                  <td className="px-4 py-3 text-slate-600">
                    <div className="space-y-1">
                      <div>{paidInfo}</div>
                      <div className="text-xs text-slate-400">{paidDate}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {schedule.transaction ? (
                      <div className="space-y-1">
                        <div className="font-medium">ID #{schedule.transaction.id}</div>
                        <div className="text-xs text-slate-400">
                          {schedule.transaction.description ?? "(sin descripción)"}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">Sin vincular</span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-slate-600">
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
                <td colSpan={canManage ? 7 : 6} className="px-4 py-6 text-center text-slate-500">
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
