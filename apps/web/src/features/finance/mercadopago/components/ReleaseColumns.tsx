import type { ReleaseTransaction } from "@finanzas/db/models";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";

import { fmtCLP } from "@/lib/format";

export const getReleaseColumns = (): ColumnDef<ReleaseTransaction>[] => [
  {
    accessorKey: "date",
    header: "Fecha",
    cell: ({ row }) => (
      <span className="text-base-content font-medium">{dayjs(row.getValue("date")).format("DD/MM/YYYY")}</span>
    ),
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
    header: "Crédito Neto",
    cell: ({ row }) => <span className="text-success">{fmtCLP(row.getValue("netCreditAmount"))}</span>,
  },
  {
    accessorKey: "netDebitAmount",
    header: "Débito Neto",
    cell: ({ row }) => <span className="text-error">{fmtCLP(row.getValue("netDebitAmount"))}</span>,
  },
  {
    accessorKey: "grossAmount",
    header: "Monto Bruto",
    cell: ({ row }) => fmtCLP(row.getValue("grossAmount")),
  },
  {
    accessorKey: "mpFeeAmount",
    header: "Comisión MP",
    cell: ({ row }) => fmtCLP(row.getValue("mpFeeAmount")),
  },
  {
    accessorKey: "financingFeeAmount",
    header: "Comisión Financiera",
    cell: ({ row }) => fmtCLP(row.getValue("financingFeeAmount")),
  },
];
