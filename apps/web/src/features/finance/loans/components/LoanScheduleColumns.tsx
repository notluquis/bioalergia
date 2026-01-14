import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";

import Button from "@/components/ui/Button";
import { currencyFormatter } from "@/lib/format";

import type { LoanSchedule } from "../types";

// Helper for late status check
const isScheduleLate = (schedule: LoanSchedule) => {
  return (
    schedule.status === "OVERDUE" ||
    (schedule.status === "PENDING" && dayjs(schedule.due_date).isBefore(dayjs(), "day"))
  );
};

export const getColumns = (
  actions: {
    onRegisterPayment: (schedule: LoanSchedule) => void;
    onUnlinkPayment: (schedule: LoanSchedule) => void;
  },
  canManage: boolean
): ColumnDef<LoanSchedule>[] => [
  {
    accessorKey: "installment_number",
    header: "#",
    cell: ({ row }) => <span className="text-base-content/70 font-medium">{row.original.installment_number}</span>,
  },
  {
    accessorKey: "due_date",
    header: "Vencimiento",
    cell: ({ row }) => {
      const schedule = row.original;
      const isLate = isScheduleLate(schedule);
      return (
        <span className={isLate ? "font-semibold text-rose-600" : ""}>
          {dayjs(schedule.due_date).format("DD MMM YYYY")}
        </span>
      );
    },
  },
  {
    accessorKey: "expected_principal",
    header: () => <div className="text-right">Capital</div>,
    cell: ({ row }) => (
      <div className="text-right font-mono text-xs opacity-70">
        {currencyFormatter.format(row.original.expected_principal)}
      </div>
    ),
  },
  {
    accessorKey: "expected_interest",
    header: () => <div className="text-right">Interés</div>,
    cell: ({ row }) => (
      <div className="text-right font-mono text-xs opacity-70">
        {currencyFormatter.format(row.original.expected_interest)}
      </div>
    ),
  },
  {
    accessorKey: "expected_amount",
    header: () => <div className="text-right">Cuota</div>,
    cell: ({ row }) => (
      <div className="text-right font-bold">{currencyFormatter.format(row.original.expected_amount)}</div>
    ),
  },
  {
    accessorKey: "status",
    header: () => <div className="text-center">Estado</div>,
    cell: ({ row }) => {
      const schedule = row.original;
      const isLate = isScheduleLate(schedule);

      let badgeClass = "badge-ghost";
      let statusLabel = "Pendiente";

      if (schedule.status === "PAID") {
        badgeClass = "badge-success text-success-content";
        statusLabel = "Pagado";
      } else if (schedule.status === "PARTIAL") {
        badgeClass = "badge-warning text-warning-content";
        statusLabel = "Parcial";
      } else if (isLate) {
        badgeClass = "badge-error text-error-content";
        statusLabel = "Vencido";
      }

      return (
        <div className="flex justify-center">
          <div className={`badge badge-sm font-semibold capitalize ${badgeClass}`}>{statusLabel}</div>
        </div>
      );
    },
  },
  {
    accessorKey: "paid_amount",
    header: () => <div className="text-right">Pagado</div>,
    cell: ({ row }) => {
      const schedule = row.original;
      if (!schedule.paid_amount) {
        return <div className="text-base-content/30 text-right">—</div>;
      }
      return (
        <div className="flex flex-col items-end">
          <span className="text-success font-bold">{currencyFormatter.format(schedule.paid_amount)}</span>
          {schedule.paid_date && (
            <span className="text-base-content/50 text-[10px]">{dayjs(schedule.paid_date).format("DD MMM")}</span>
          )}
        </div>
      );
    },
  },
  ...(canManage
    ? [
        {
          id: "actions",
          header: () => <div className="text-right">Acciones</div>,
          cell: ({ row }) => {
            const schedule = row.original;
            return (
              <div className="flex justify-end">
                {schedule.status === "PAID" || schedule.status === "PARTIAL" ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => actions.onUnlinkPayment(schedule)}
                    title="Desvincular pago"
                  >
                    Desvincular
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="xs"
                    onClick={() => actions.onRegisterPayment(schedule)}
                    disabled={schedule.loan_id === 0}
                  >
                    Pagar
                  </Button>
                )}
              </div>
            );
          },
        } as ColumnDef<LoanSchedule>,
      ]
    : []),
];
