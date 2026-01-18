import type { ColumnDef } from "@tanstack/react-table";

import type { EmployeeWorkData } from "../types";

import { minutesToTime } from "../utils";

export interface HRReportsTableMeta {
  totals?: {
    totalDays: number;
    totalHours: number;
  };
}

export const getHRReportsColumns = (): ColumnDef<EmployeeWorkData>[] => [
  {
    accessorKey: "fullName",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <div className="bg-primary/20 h-6 w-1 rounded-full" />
        <div>
          <div className="font-bold">{row.original.fullName}</div>
          <div className="text-[10px] tracking-widest uppercase opacity-50">{row.original.role}</div>
        </div>
      </div>
    ),
    footer: "Total",
    header: "Empleado",
  },
  {
    accessorKey: "totalDays",
    cell: ({ getValue }) => <div className="text-right font-medium">{getValue() as number}</div>,
    footer: ({ table }) => {
      const meta = table.options.meta as HRReportsTableMeta;
      return <div className="text-right font-bold">{meta.totals?.totalDays ?? 0}</div>;
    },
    header: "Días",
    meta: {
      headerClassName: "text-right",
    },
  },
  {
    accessorKey: "avgDailyMinutes",
    cell: ({ getValue }) => <div className="text-right font-mono">{minutesToTime(getValue() as number)}</div>,
    footer: () => <div className="text-right font-bold">-</div>,
    header: "Diario",
    meta: {
      headerClassName: "text-right",
    },
  },
  {
    accessorKey: "totalMinutes",
    cell: ({ getValue }) => {
      const hours = Number.parseFloat(((getValue() as number) / 60).toFixed(1));
      return <div className="text-right font-mono text-base">{hours}</div>;
    },
    footer: ({ table }) => {
      const meta = table.options.meta as HRReportsTableMeta;
      return <div className="text-right font-bold">{meta.totals?.totalHours ?? 0}</div>;
    },
    header: "Horas",
    meta: {
      headerClassName: "text-right",
    },
  },
];
