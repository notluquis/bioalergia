import dayjs from "dayjs";
import Button from "../../../components/Button";
import type { ServiceSchedule } from "../types";

interface ServiceScheduleTableProps {
  schedules: ServiceSchedule[];
  canManage: boolean;
  onRegisterPayment: (schedule: ServiceSchedule) => void;
  onUnlinkPayment: (schedule: ServiceSchedule) => void;
}

function statusBadge(status: ServiceSchedule["status"], dueDate: string) {
  const today = dayjs().startOf("day");
  const due = dayjs(dueDate);
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "PARTIAL") return "bg-amber-100 text-amber-700";
  if (status === "SKIPPED") return "bg-slate-100 text-slate-500";
  return due.isBefore(today) ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600";
}

export function ServiceScheduleTable({
  schedules,
  canManage,
  onRegisterPayment,
  onUnlinkPayment,
}: ServiceScheduleTableProps) {
  return (
    <div className="overflow-hidden bg-base-100">
      <table className="min-w-full text-sm text-slate-600">
        <thead className="bg-base-100/60 text-[var(--brand-primary)]">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Periodo</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Vencimiento</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Monto</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Estado</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Pago</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Transacción</th>
            {canManage && (
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Acciones</th>
            )}
          </tr>
        </thead>
        <tbody>
          {schedules.map((schedule) => {
            const badgeClass = statusBadge(schedule.status, schedule.due_date);
            return (
              <tr key={schedule.id} className="border-b border-white/45 bg-base-100/45 last:border-none even:bg-base-100/35">
                <td className="px-4 py-3 font-semibold text-slate-700">
                  {dayjs(schedule.period_start).format("MMM YYYY")}
                </td>
                <td className="px-4 py-3 text-slate-600">{dayjs(schedule.due_date).format("DD MMM YYYY")}</td>
                <td className="px-4 py-3 text-slate-600">
                  <div className="font-semibold text-slate-700">
                    ${schedule.effective_amount.toLocaleString("es-CL")}
                  </div>
                  {schedule.late_fee_amount > 0 && (
                    <div className="text-[11px] text-rose-500">
                      Incluye recargo ${schedule.late_fee_amount.toLocaleString("es-CL")}
                    </div>
                  )}
                  {schedule.late_fee_amount === 0 && schedule.expected_amount !== schedule.effective_amount && (
                    <div className="text-[11px] text-slate-400">Monto ajustado</div>
                  )}
                  {schedule.overdue_days > 0 && schedule.status === "PENDING" && (
                    <div className="text-[11px] text-rose-400">{schedule.overdue_days} días de atraso</div>
                  )}
                  {schedule.late_fee_amount > 0 && (
                    <div className="text-[11px] text-slate-400">
                      Base ${schedule.expected_amount.toLocaleString("es-CL")}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${badgeClass}`}
                  >
                    {schedule.status === "PAID"
                      ? "Pagado"
                      : schedule.status === "PARTIAL"
                        ? "Parcial"
                        : schedule.status === "SKIPPED"
                          ? "Omitido"
                          : "Pendiente"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <div className="space-y-1">
                    <div>{schedule.paid_amount != null ? `$${schedule.paid_amount.toLocaleString("es-CL")}` : "—"}</div>
                    <div className="text-[11px] text-slate-400">
                      {schedule.paid_date ? dayjs(schedule.paid_date).format("DD MMM YYYY") : "—"}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {schedule.transaction ? (
                    <div className="space-y-1">
                      <div className="font-medium">ID #{schedule.transaction.id}</div>
                      <div className="text-[11px] text-slate-400">
                        {schedule.transaction.description ?? "(sin descripción)"}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400">Sin vincular</span>
                  )}
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {(schedule.status === "PENDING" || schedule.status === "PARTIAL") && (
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
                No hay periodos generados aún.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default ServiceScheduleTable;
