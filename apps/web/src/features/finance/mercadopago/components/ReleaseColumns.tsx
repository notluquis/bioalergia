import type { ReleaseTransaction } from "@finanzas/db/models";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";

import { fmtCLP } from "@/lib/format";

export const getReleaseColumns = (): ColumnDef<ReleaseTransaction>[] => [
  {
    accessorKey: "date",
    cell: ({ row }) => (
      <span className="text-base-content font-medium">
        {dayjs(row.getValue("date")).format("DD/MM/YYYY")}
      </span>
    ),
    header: "Fecha",
  },
  {
    accessorKey: "sourceId",
    header: "ID Origen",
  },
  {
    accessorKey: "externalReference",
    header: "Ref. Externa",
  },
  {
    accessorKey: "netCreditAmount",
    cell: ({ row }) => (
      <span className="text-success">{fmtCLP(row.getValue("netCreditAmount"))}</span>
    ),
    header: "Crédito Neto",
  },
  {
    accessorKey: "netDebitAmount",
    cell: ({ row }) => <span className="text-error">{fmtCLP(row.getValue("netDebitAmount"))}</span>,
    header: "Débito Neto",
  },
  {
    accessorKey: "grossAmount",
    cell: ({ row }) => fmtCLP(row.getValue("grossAmount")),
    header: "Monto Bruto",
  },
  {
    accessorKey: "mpFeeAmount",
    cell: ({ row }) => fmtCLP(row.getValue("mpFeeAmount")),
    header: "Comisión MP",
  },
  {
    accessorKey: "financingFeeAmount",
    cell: ({ row }) => fmtCLP(row.getValue("financingFeeAmount")),
    header: "Comisión Financiera",
  },
];
