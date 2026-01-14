import type { SettlementTransaction } from "@finanzas/db/models";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";

import { fmtCLP } from "@/lib/format";

export const getSettlementColumns = (): ColumnDef<SettlementTransaction>[] => [
  {
    accessorKey: "transactionDate",
    header: "Fecha",
    cell: ({ row }) => (
      <span className="text-base-content font-medium">
        {dayjs(row.getValue("transactionDate")).format("DD/MM/YYYY")}
      </span>
    ),
  },
  {
    accessorKey: "transactionType",
    header: "Tipo",
  },
  {
    accessorKey: "transactionAmount",
    header: "Monto Transacción",
    cell: ({ row }) => fmtCLP(row.getValue("transactionAmount")),
  },
  {
    accessorKey: "settlementNetAmount",
    header: "Monto Neto",
    cell: ({ row }) => <span className="font-semibold">{fmtCLP(row.getValue("settlementNetAmount"))}</span>,
  },
  {
    accessorKey: "realAmount",
    header: "Monto Real",
    cell: ({ row }) => fmtCLP(row.getValue("realAmount")),
  },
  {
    accessorKey: "couponAmount",
    header: "Cupón",
    cell: ({ row }) => fmtCLP(row.getValue("couponAmount")),
  },
  {
    accessorKey: "taxesAmount",
    header: "Impuestos",
    cell: ({ row }) => fmtCLP(row.getValue("taxesAmount")),
  },
  {
    accessorKey: "installments",
    header: "Cuotas",
  },
];
