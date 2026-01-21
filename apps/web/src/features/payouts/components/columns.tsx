import type { ReleaseTransaction } from "@finanzas/db/models";
import { Chip } from "@heroui/react";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { fmtCLP } from "@/lib/format";

export const columns: ColumnDef<ReleaseTransaction>[] = [
  {
    accessorKey: "date",
    cell: ({ row }) => (
      <span className="text-base-content font-medium whitespace-nowrap">
        {dayjs(row.original.date).format("DD MMM YYYY HH:mm")}
      </span>
    ),
    header: "Fecha",
  },
  {
    accessorKey: "externalReference",
    cell: ({ row }) => (
      <span className="text-base-content/70 font-mono text-xs">
        {row.original.externalReference || "-"}
      </span>
    ),
    header: "Referencia",
  },
  {
    accessorKey: "description",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Chip size="sm" variant="secondary">
          {row.original.description}
        </Chip>
      </div>
    ),
    header: "Descripción",
  },
  {
    accessorKey: "grossAmount",
    cell: ({ row }) => (
      <div className="text-right font-medium">{fmtCLP(String(row.original.grossAmount))}</div>
    ),
    header: "Monto Bruto",
  },
  {
    accessorKey: "netDebitAmount",
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
    header: "Débito Neto",
  },
  {
    accessorKey: "netCreditAmount",
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
    header: "Crédito Neto",
  },
  {
    accessorKey: "balanceAmount",
    cell: ({ row }) => (
      <div className="text-base-content text-right font-bold">
        {row.original.balanceAmount ? fmtCLP(String(row.original.balanceAmount)) : "-"}
      </div>
    ),
    header: "Balance",
  },
  {
    accessorKey: "payoutBankAccountNumber",
    cell: ({ row }) => (
      <span className="text-base-content/70 font-mono text-xs">
        {row.original.payoutBankAccountNumber || "-"}
      </span>
    ),
    header: "Cuenta Destino",
  },
];
