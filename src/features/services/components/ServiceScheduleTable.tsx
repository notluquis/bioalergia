import dayjs from "dayjs";
import Button from "@/components/ui/Button";
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
  if (status === "PAID") return "bg-success/15 text-success";
  if (status === "PARTIAL") return "bg-warning/15 text-warning";
  if (status === "SKIPPED") return "bg-base-200 text-base-content";
  return due.isBefore(today) ? "bg-error/15 text-error" : "bg-base-200 text-base-content";
}

export function ServiceScheduleTable({
  schedules,
  canManage,
  onRegisterPayment,
  onUnlinkPayment,
}: ServiceScheduleTableProps) {
  return (
    <div className="bg-base-100 overflow-hidden">
      <table className="text-base-content min-w-full text-sm">
        <thead className="bg-base-200 text-primary">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">Periodo</th>
            <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">Vencimiento</th>
            <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">Monto</th>
            <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">Estado</th>
            <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">Pago</th>
            <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">Transacción</th>
            {canManage && (
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">Acciones</th>
            )}
          </tr>
        </thead>
        <tbody>
          {schedules.map((schedule) => {
            const badgeClass = statusBadge(schedule.status, schedule.due_date);
            return (
              <tr key={schedule.id} className="border-base-300 bg-base-200 even:bg-base-300 border-b last:border-none">
                <td className="text-base-content px-4 py-3 font-semibold">
                  {dayjs(schedule.period_start).format("MMM YYYY")}
                </td>
                <td className="text-base-content px-4 py-3">{dayjs(schedule.due_date).format("DD MMM YYYY")}</td>
                <td className="text-base-content px-4 py-3">
                  <div className="text-base-content font-semibold">
                    ${schedule.effective_amount.toLocaleString("es-CL")}
                  </div>
                  {schedule.late_fee_amount > 0 && (
                    <div className="text-error text-xs">
                      Incluye recargo ${schedule.late_fee_amount.toLocaleString("es-CL")}
                    </div>
                  )}
                  {schedule.late_fee_amount === 0 && schedule.expected_amount !== schedule.effective_amount && (
                    <div className="text-base-content/50 text-xs">Monto ajustado</div>
                  )}
                  {schedule.overdue_days > 0 && schedule.status === "PENDING" && (
                    <div className="text-error text-xs">{schedule.overdue_days} días de atraso</div>
                  )}
                  {schedule.late_fee_amount > 0 && (
                    <div className="text-base-content/50 text-xs">
                      Base ${schedule.expected_amount.toLocaleString("es-CL")}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase ${badgeClass}`}
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
                <td className="text-base-content px-4 py-3">
                  <div className="space-y-1">
                    <div>{schedule.paid_amount != null ? `$${schedule.paid_amount.toLocaleString("es-CL")}` : "—"}</div>
                    <div className="text-base-content/50 text-xs">
                      {schedule.paid_date ? dayjs(schedule.paid_date).format("DD MMM YYYY") : "—"}
                    </div>
                  </div>
                </td>
                <td className="text-base-content px-4 py-3">
                  {schedule.transaction ? (
                    <div className="space-y-1">
                      <div className="font-medium">ID #{schedule.transaction.id}</div>
                      <div className="text-base-content/50 text-xs">
                        {schedule.transaction.description ?? "(sin descripción)"}
                      </div>
                    </div>
                  ) : (
                    <span className="text-base-content/50">Sin vincular</span>
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
              <td colSpan={canManage ? 7 : 6} className="text-base-content/60 px-4 py-6 text-center">
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
