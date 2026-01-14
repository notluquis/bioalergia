import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";

import Button from "@/components/ui/Button";

import type { ServiceSchedule } from "../types";

// Helper for status badge style
function getStatusBadgeClass(status: ServiceSchedule["status"], dueDate: string) {
  const today = dayjs().startOf("day");
  const due = dayjs(dueDate);
  if (status === "PAID") return "bg-success/15 text-success";
  if (status === "PARTIAL") return "bg-warning/15 text-warning";
  if (status === "SKIPPED") return "bg-base-200 text-base-content";
  return due.isBefore(today) ? "bg-error/15 text-error" : "bg-base-200 text-base-content";
}

// Helper for status label
function getStatusLabel(status: ServiceSchedule["status"]) {
  if (status === "PAID") return "Pagado";
  if (status === "PARTIAL") return "Parcial";
  if (status === "SKIPPED") return "Omitido";
  return "Pendiente";
}

export const getColumns = (
  actions: {
    onRegisterPayment: (schedule: ServiceSchedule) => void;
    onUnlinkPayment: (schedule: ServiceSchedule) => void;
  },
  canManage: boolean
): ColumnDef<ServiceSchedule>[] => [
  {
    accessorKey: "period_start",
    header: "Periodo",
    cell: ({ row }) => (
      <span className="text-base-content font-semibold">{dayjs(row.original.period_start).format("MMM YYYY")}</span>
    ),
  },
  {
    accessorKey: "due_date",
    header: "Vencimiento",
    cell: ({ row }) => <span className="text-base-content">{dayjs(row.original.due_date).format("DD MMM YYYY")}</span>,
  },
  {
    accessorKey: "effective_amount",
    header: "Monto",
    cell: ({ row }) => {
      const schedule = row.original;
      return (
        <div className="space-y-0.5">
          <div className="text-base-content font-semibold">${schedule.effective_amount.toLocaleString("es-CL")}</div>
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
            <div className="text-base-content/50 text-xs">Base ${schedule.expected_amount.toLocaleString("es-CL")}</div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => {
      const schedule = row.original;
      const badgeClass = getStatusBadgeClass(schedule.status, schedule.due_date);
      return (
        <span className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase ${badgeClass}`}>
          {getStatusLabel(schedule.status)}
        </span>
      );
    },
  },
  {
    id: "payment",
    header: "Pago",
    cell: ({ row }) => {
      const schedule = row.original;
      return (
        <div className="space-y-1">
          <div>{schedule.paid_amount == null ? "—" : `$${schedule.paid_amount.toLocaleString("es-CL")}`}</div>
          <div className="text-base-content/50 text-xs">
            {schedule.paid_date ? dayjs(schedule.paid_date).format("DD MMM YYYY") : "—"}
          </div>
        </div>
      );
    },
  },
  {
    id: "transaction",
    header: "Transacción",
    cell: ({ row }) => {
      const schedule = row.original;
      if (!schedule.transaction) {
        return <span className="text-base-content/50">Sin vincular</span>;
      }
      return (
        <div className="space-y-1">
          <div className="font-medium">ID #{schedule.transaction.id}</div>
          <div className="text-base-content/50 text-xs">{schedule.transaction.description ?? "(sin descripción)"}</div>
        </div>
      );
    },
  },
  // Actions column visibility is controlled by logic inside the cell or we can only include this column via conditional array spread in the caller
  // But standard way is to include it and return null or use visibility state.
  // However, simpler to just allow it to render empty if !canManage, OR pass everything and use `canManage` inside cell render.
  // The props pass `canManage` to `getColumns`, so we can use it.
  ...(canManage
    ? [
        {
          id: "actions",
          header: "Acciones",
          cell: ({ row }) => {
            const schedule = row.original;
            return (
              <div className="flex flex-wrap gap-2">
                {(schedule.status === "PENDING" || schedule.status === "PARTIAL") && (
                  <Button type="button" size="xs" onClick={() => actions.onRegisterPayment(schedule)}>
                    Registrar pago
                  </Button>
                )}
                {schedule.transaction && (
                  <Button type="button" variant="secondary" size="xs" onClick={() => actions.onUnlinkPayment(schedule)}>
                    Desvincular
                  </Button>
                )}
              </div>
            );
          },
        } as ColumnDef<ServiceSchedule>,
      ]
    : []),
];
