import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";

import { fmtCLP } from "@/lib/format";

import type { TimesheetSummaryRow } from "../types";

export interface SummaryTotals {
  extraAmount: number;
  hours: string;
  net: number;
  overtime: string;
  retention: number;
  subtotal: number;
}

// Define the shape of our meta to include totals
interface TableMeta {
  totals?: SummaryTotals;
}

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
    cell: ({ getValue }) => <span className="text-base-content/60">{getValue() as string}</span>,
    header: "Función",
  },
  {
    accessorKey: "hoursFormatted",
    footer: ({ table }) => {
      const meta = table.options.meta as TableMeta;
      return meta.totals?.hours;
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
      const meta = table.options.meta as TableMeta;
      return meta.totals?.overtime;
    },
    header: "Extras",
  },
  {
    accessorKey: "subtotal",
    cell: ({ getValue }) => fmtCLP(getValue() as number),
    footer: ({ table }) => {
      const meta = table.options.meta as TableMeta;
      return meta.totals ? fmtCLP(meta.totals.subtotal) : null;
    },
    header: "Subtotal",
  },
  {
    accessorKey: "retention",
    cell: ({ getValue }) => fmtCLP(getValue() as number),
    footer: ({ table }) => {
      const meta = table.options.meta as TableMeta;
      return meta.totals ? fmtCLP(meta.totals.retention) : null;
    },
    header: "Retención",
  },
  {
    accessorKey: "net",
    cell: ({ getValue }) => fmtCLP(getValue() as number),
    footer: ({ table }) => {
      const meta = table.options.meta as TableMeta;
      return meta.totals ? fmtCLP(meta.totals.net) : null;
    },
    header: "Líquido",
  },
  {
    accessorKey: "payDate",
    cell: ({ getValue }) => {
      const val = getValue() as null | string;
      return val && dayjs(val).isValid() ? dayjs(val).format("DD-MM-YYYY") : val || "—";
    },
    header: "Fecha pago",
  },
];
