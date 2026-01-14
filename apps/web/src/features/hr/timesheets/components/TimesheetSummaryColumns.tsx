import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";

import { fmtCLP } from "@/lib/format";

import type { TimesheetSummaryRow } from "../types";

export type SummaryTotals = {
  hours: string;
  overtime: string;
  extraAmount: number;
  subtotal: number;
  retention: number;
  net: number;
};

// Define the shape of our meta to include totals
interface TableMeta {
  totals?: SummaryTotals;
}

export const getTimesheetSummaryColumns = (): ColumnDef<TimesheetSummaryRow>[] => [
  {
    accessorKey: "fullName",
    header: "Trabajador",
    footer: "TOTAL", // Appears in the first column
    meta: {
      className: "font-medium",
    },
  },
  {
    accessorKey: "role",
    header: "Función",
    cell: ({ getValue }) => <span className="text-base-content/60">{getValue() as string}</span>,
  },
  {
    accessorKey: "hoursFormatted",
    header: "Horas trabajadas",
    footer: ({ table }) => {
      const meta = table.options.meta as TableMeta;
      return meta.totals?.hours;
    },
  },
  {
    accessorKey: "hourlyRate",
    header: "Tarifa",
    cell: ({ getValue }) => fmtCLP(getValue() as number),
  },
  {
    accessorKey: "overtimeFormatted",
    header: "Extras",
    cell: ({ getValue }) => getValue() as string,
    footer: ({ table }) => {
      const meta = table.options.meta as TableMeta;
      return meta.totals?.overtime;
    },
  },
  {
    accessorKey: "subtotal",
    header: "Subtotal",
    cell: ({ getValue }) => fmtCLP(getValue() as number),
    footer: ({ table }) => {
      const meta = table.options.meta as TableMeta;
      return meta.totals ? fmtCLP(meta.totals.subtotal) : null;
    },
  },
  {
    accessorKey: "retention",
    header: "Retención",
    cell: ({ getValue }) => fmtCLP(getValue() as number),
    footer: ({ table }) => {
      const meta = table.options.meta as TableMeta;
      return meta.totals ? fmtCLP(meta.totals.retention) : null;
    },
  },
  {
    accessorKey: "net",
    header: "Líquido",
    cell: ({ getValue }) => fmtCLP(getValue() as number),
    footer: ({ table }) => {
      const meta = table.options.meta as TableMeta;
      return meta.totals ? fmtCLP(meta.totals.net) : null;
    },
  },
  {
    accessorKey: "payDate",
    header: "Fecha pago",
    cell: ({ getValue }) => {
      const val = getValue() as string | null;
      return val && dayjs(val).isValid() ? dayjs(val).format("DD-MM-YYYY") : val || "—";
    },
  },
];
