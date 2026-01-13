import { ReleaseTransaction } from "@finanzas/db/models";
import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { fmtCLP } from "@/lib/format";

export const columns: ColumnDef<ReleaseTransaction>[] = [
  {
    accessorKey: "date",
    header: "Fecha",
    cell: ({ row }) => (
      <span className="text-base-content font-medium whitespace-nowrap">
        {dayjs(row.original.date).format("DD MMM YYYY HH:mm")}
      </span>
    ),
  },
  {
    accessorKey: "externalReference",
    header: "Referencia",
    cell: ({ row }) => (
      <span className="text-base-content/70 font-mono text-xs">{row.original.externalReference || "-"}</span>
    ),
  },
  {
    accessorKey: "description",
    header: "Descripción",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="badge badge-sm badge-ghost">{row.original.description}</span>
      </div>
    ),
  },
  {
    accessorKey: "grossAmount",
    header: "Monto Bruto",
    cell: ({ row }) => <div className="text-right font-medium">{fmtCLP(String(row.original.grossAmount))}</div>,
  },
  {
    accessorKey: "netDebitAmount",
    header: "Débito Neto",
    cell: ({ row }) => {
      const amount = row.original.netDebitAmount;
      if (!amount) return <div className="text-right">-</div>;
      return (
        <div className="text-error flex items-center justify-end gap-1 font-medium">
          {fmtCLP(String(amount))}
          <ArrowDownLeft className="h-3 w-3" />
        </div>
      );
    },
  },
  {
    accessorKey: "netCreditAmount",
    header: "Crédito Neto",
    cell: ({ row }) => {
      const amount = row.original.netCreditAmount;
      if (!amount) return <div className="text-right">-</div>;
      return (
        <div className="text-success flex items-center justify-end gap-1 font-medium">
          {fmtCLP(String(amount))}
          <ArrowUpRight className="h-3 w-3" />
        </div>
      );
    },
  },
  {
    accessorKey: "balanceAmount",
    header: "Balance",
    cell: ({ row }) => (
      <div className="text-base-content text-right font-bold">
        {row.original.balanceAmount ? fmtCLP(String(row.original.balanceAmount)) : "-"}
      </div>
    ),
  },
  {
    accessorKey: "payoutBankAccountNumber",
    header: "Cuenta Destino",
    cell: ({ row }) => (
      <span className="text-base-content/70 font-mono text-xs">{row.original.payoutBankAccountNumber || "-"}</span>
    ),
  },
];
