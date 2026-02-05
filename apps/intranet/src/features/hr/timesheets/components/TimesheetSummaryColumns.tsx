import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";

import { fmtCLP } from "@/lib/format";

import type { TimesheetSummaryRow } from "../types";

export const getTimesheetSummaryColumns = (): ColumnDef<TimesheetSummaryRow>[] => [
  {
    accessorKey: "fullName",
    footer: "TOTAL", // Appears in the first column
    header: "Trabajador",
    meta: {
      className: "font-medium",
    },
  },
  {
    accessorKey: "role",
    cell: ({ getValue }) => <span className="text-default-500">{getValue() as string}</span>,
    header: "Función",
  },
  {
    accessorKey: "hoursFormatted",
    footer: ({ table }) => {
      return table.options.meta?.totals?.hours;
    },
    header: "Horas trabajadas",
  },
  {
    accessorKey: "hourlyRate",
    cell: ({ getValue }) => fmtCLP(getValue() as number),
    header: "Tarifa",
  },
  {
    accessorKey: "overtimeFormatted",
    cell: ({ getValue }) => getValue() as string,
    footer: ({ table }) => {
      return table.options.meta?.totals?.overtime;
    },
    header: "Extras",
  },
  {
    accessorKey: "subtotal",
    cell: ({ getValue }) => fmtCLP(getValue() as number),
    footer: ({ table }) => {
      return table.options.meta?.totals ? fmtCLP(table.options.meta.totals.subtotal) : null;
    },
    header: "Subtotal",
  },
  {
    accessorKey: "retention",
    cell: ({ getValue }) => fmtCLP(getValue() as number),
    footer: ({ table }) => {
      return table.options.meta?.totals ? fmtCLP(table.options.meta.totals.retention) : null;
    },
    header: "Retención",
  },
  {
    accessorKey: "net",
    cell: ({ getValue }) => fmtCLP(getValue() as number),
    footer: ({ table }) => {
      return table.options.meta?.totals ? fmtCLP(table.options.meta.totals.net) : null;
    },
    header: "Líquido",
  },
  {
    accessorKey: "payDate",
    cell: ({ getValue }) => {
      const val = getValue() as null | string;
      return val && dayjs(val, "YYYY-MM-DD", true).isValid()
        ? dayjs(val, "YYYY-MM-DD").format("DD-MM-YYYY")
        : "—";
    },
    header: "Fecha pago",
  },
];
