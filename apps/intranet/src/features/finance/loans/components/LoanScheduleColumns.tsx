import { Button, Chip, type ChipProps } from "@heroui/react";
import type { ColumnDef } from "@tanstack/react-table";
import { chileDay, formatChile, today } from "@/lib/dates";
import { currencyFormatter } from "@/lib/format";

import type { LoanSchedule } from "../types";

// Helper for late status check
const isScheduleLate = (schedule: LoanSchedule) => {
  return (
    schedule.status === "OVERDUE" ||
    (schedule.status === "PENDING" && chileDay(schedule.due_date) < today())
  );
};

export const getColumns = (
  actions: {
    onEditSchedule: (schedule: LoanSchedule) => void;
    onRegisterPayment: (schedule: LoanSchedule) => void;
    onUnlinkPayment: (schedule: LoanSchedule) => void;
  },
  canManage: boolean
): ColumnDef<LoanSchedule>[] => [
  {
    accessorKey: "installment_number",
    cell: ({ row }) => (
      <span className="font-medium text-default-600">{row.original.installment_number}</span>
    ),

    header: "#",
  },
  {
    accessorKey: "due_date",
    cell: ({ row }) => {
      const schedule = row.original;
      const isLate = isScheduleLate(schedule);
      return (
        <span className={isLate ? "font-semibold text-rose-600" : ""}>
          {formatChile(schedule.due_date, "DD MMM YYYY")}
        </span>
      );
    },
    header: "Vencimiento",
  },
  {
    accessorKey: "expected_principal",
    cell: ({ row }) => (
      <div className="text-right font-mono text-xs opacity-70">
        {currencyFormatter.format(row.original.expected_principal)}
      </div>
    ),

    header: () => <div className="text-right">Capital</div>,
  },
  {
    accessorKey: "expected_interest",
    cell: ({ row }) => (
      <div className="text-right font-mono text-xs opacity-70">
        {currencyFormatter.format(row.original.expected_interest)}
      </div>
    ),

    header: () => <div className="text-right">Interés</div>,
  },
  {
    accessorKey: "expected_amount",
    cell: ({ row }) => (
      <div className="text-right font-bold">
        {currencyFormatter.format(row.original.expected_amount)}
      </div>
    ),

    header: () => <div className="text-right">Cuota</div>,
  },
  {
    accessorKey: "status",
    cell: ({ row }) => {
      const schedule = row.original;
      const isLate = isScheduleLate(schedule);

      const props: { color: ChipProps["color"]; variant: ChipProps["variant"] } = {
        color: "default",
        variant: "secondary",
      };
      let statusLabel = "Pendiente";

      if (schedule.status === "PAID") {
        props.color = "success";
        props.variant = "primary";
        statusLabel = "Pagado";
      } else if (schedule.status === "PARTIAL") {
        props.color = "warning";
        props.variant = "primary";
        statusLabel = "Parcial";
      } else if (isLate) {
        props.color = "danger";
        props.variant = "primary";
        statusLabel = "Vencido";
      }

      return (
        <div className="flex justify-center">
          <Chip className="font-semibold capitalize" size="sm" {...props}>
            {statusLabel}
          </Chip>
        </div>
      );
    },
    header: () => <div className="text-center">Estado</div>,
  },
  {
    accessorKey: "paid_amount",
    cell: ({ row }) => {
      const schedule = row.original;
      if (!schedule.paid_amount) {
        return <div className="text-right text-default-200">—</div>;
      }
      return (
        <div className="flex min-w-28 flex-col items-end gap-1">
          <span className="font-bold text-success">
            {currencyFormatter.format(schedule.paid_amount)}
          </span>
          <div className="flex items-center gap-1 text-default-400 text-xs">
            {schedule.paid_date && <span>{formatChile(schedule.paid_date, "DD MMM")}</span>}
            {schedule.payments && schedule.payments.length > 1 && (
              <span>· {schedule.payments.length} pagos</span>
            )}
          </div>
          {schedule.payments && schedule.payments.length === 1 && (
            <span className="max-w-28 truncate text-default-500 text-xs">
              {schedule.payments[0]?.kind === "DISCOUNT"
                ? "Desc."
                : schedule.payments[0]?.kind === "ADJUSTMENT"
                  ? "Ajuste"
                  : "Pago"}{" "}
              {currencyFormatter.format(schedule.payments[0]?.amount ?? 0)}
            </span>
          )}
          {schedule.payments && schedule.payments.length > 1 && (
            <div className="flex max-w-40 flex-wrap justify-end gap-1">
              {schedule.payments.map((payment) => (
                <span
                  className="rounded-full bg-default-100 px-1.5 py-0.5 text-default-600 text-xs"
                  key={payment.id}
                >
                  {currencyFormatter.format(payment.amount)}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    },
    header: () => <div className="text-right">Pagado</div>,
  },
  ...(canManage
    ? [
        {
          cell: ({ row }) => {
            const schedule = row.original;
            const hasPayments = schedule.status === "PAID" || schedule.status === "PARTIAL";
            return (
              <div className="flex justify-end gap-2">
                <Button
                  onPress={() => {
                    actions.onEditSchedule(schedule);
                  }}
                  size="sm"
                  variant="secondary"
                >
                  Editar
                </Button>
                {schedule.status !== "PAID" && (
                  <Button
                    isDisabled={schedule.loan_id === 0}
                    onPress={() => {
                      actions.onRegisterPayment(schedule);
                    }}
                    size="sm"
                    variant="primary"
                  >
                    {schedule.status === "PARTIAL" ? "Agregar" : "Pagar"}
                  </Button>
                )}
                {hasPayments && (
                  <Button
                    onPress={() => {
                      actions.onUnlinkPayment(schedule);
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Desvincular
                  </Button>
                )}
              </div>
            );
          },
          header: () => <div className="text-right">Acciones</div>,
          id: "actions",
        } as ColumnDef<LoanSchedule>,
      ]
    : []),
];
