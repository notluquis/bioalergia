import { Chip } from "@heroui/react";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";

import Button from "@/components/ui/Button";

import type { ServiceSchedule } from "../types";

// Helper for status label
function getStatusLabel(status: ServiceSchedule["status"]) {
  if (status === "PAID") {
    return "Pagado";
  }
  if (status === "PARTIAL") {
    return "Parcial";
  }
  if (status === "SKIPPED") {
    return "Omitido";
  }
  return "Pendiente";
}

export const getColumns = (
  actions: {
    onRegisterPayment: (schedule: ServiceSchedule) => void;
    onUnlinkPayment: (schedule: ServiceSchedule) => void;
  },
  canManage: boolean,
): ColumnDef<ServiceSchedule>[] => [
  {
    accessorKey: "period_start",
    cell: ({ row }) => (
      <span className="font-semibold text-foreground">
        {dayjs(row.original.period_start).format("MMM YYYY")}
      </span>
    ),
    header: "Periodo",
  },
  {
    accessorKey: "due_date",
    cell: ({ row }) => (
      <span className="text-foreground">{dayjs(row.original.due_date).format("DD MMM YYYY")}</span>
    ),
    header: "Vencimiento",
  },
  {
    accessorKey: "effective_amount",
    cell: ({ row }) => {
      const schedule = row.original;
      return (
        <div className="space-y-0.5">
          <div className="font-semibold text-foreground">
            ${schedule.effective_amount.toLocaleString("es-CL")}
          </div>
          {schedule.late_fee_amount > 0 && (
            <div className="text-danger text-xs">
              Incluye recargo ${schedule.late_fee_amount.toLocaleString("es-CL")}
            </div>
          )}
          {schedule.late_fee_amount === 0 &&
            schedule.expected_amount !== schedule.effective_amount && (
              <div className="text-default-400 text-xs">Monto ajustado</div>
            )}
          {schedule.overdue_days > 0 && schedule.status === "PENDING" && (
            <div className="text-danger text-xs">{schedule.overdue_days} días de atraso</div>
          )}
          {schedule.late_fee_amount > 0 && (
            <div className="text-default-400 text-xs">
              Base ${schedule.expected_amount.toLocaleString("es-CL")}
            </div>
          )}
        </div>
      );
    },
    header: "Monto",
  },
  {
    accessorKey: "status",
    cell: ({ row }) => {
      const schedule = row.original;
      let color: "success" | "warning" | "default" | "danger" = "default";

      const today = dayjs().startOf("day");
      const due = dayjs(schedule.due_date);

      if (schedule.status === "PAID") {
        color = "success";
      } else if (schedule.status === "PARTIAL") {
        color = "warning";
      } else if (schedule.status === "SKIPPED") {
        color = "default";
      } else if (due.isBefore(today)) {
        color = "danger";
      }

      return (
        <Chip
          className="font-semibold uppercase tracking-wide"
          color={color}
          size="sm"
          variant="soft"
        >
          {getStatusLabel(schedule.status)}
        </Chip>
      );
    },
    header: "Estado",
  },
  {
    cell: ({ row }) => {
      const schedule = row.original;
      return (
        <div className="space-y-1">
          <div>
            {schedule.paid_amount == null
              ? "—"
              : `$${schedule.paid_amount.toLocaleString("es-CL")}`}
          </div>
          <div className="text-default-400 text-xs">
            {schedule.paid_date ? dayjs(schedule.paid_date).format("DD MMM YYYY") : "—"}
          </div>
        </div>
      );
    },
    header: "Pago",
    id: "payment",
  },
  {
    cell: ({ row }) => {
      const schedule = row.original;
      if (!schedule.transaction) {
        return <span className="text-default-400">Sin vincular</span>;
      }
      return (
        <div className="space-y-1">
          <div className="font-medium">ID #{schedule.transaction.id}</div>
          <div className="text-default-400 text-xs">
            {schedule.transaction.description ?? "(sin descripción)"}
          </div>
        </div>
      );
    },
    header: "Transacción",
    id: "transaction",
  },
  // Actions column visibility is controlled by logic inside the cell or we can only include this column via conditional array spread in the caller
  // But standard way is to include it and return null or use visibility state.
  // However, simpler to just allow it to render empty if !canManage, OR pass everything and use `canManage` inside cell render.
  // The props pass `canManage` to `getColumns`, so we can use it.
  ...(canManage
    ? [
        {
          cell: ({ row }) => {
            const schedule = row.original;
            return (
              <div className="flex flex-wrap gap-2">
                {(schedule.status === "PENDING" || schedule.status === "PARTIAL") && (
                  <Button
                    onClick={() => {
                      actions.onRegisterPayment(schedule);
                    }}
                    size="xs"
                    type="button"
                  >
                    Registrar pago
                  </Button>
                )}
                {schedule.transaction && (
                  <Button
                    onClick={() => {
                      actions.onUnlinkPayment(schedule);
                    }}
                    size="xs"
                    type="button"
                    variant="secondary"
                  >
                    Desvincular
                  </Button>
                )}
              </div>
            );
          },
          header: "Acciones",
          id: "actions",
        } as ColumnDef<ServiceSchedule>,
      ]
    : []),
];
