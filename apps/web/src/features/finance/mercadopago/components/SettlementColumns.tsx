import type { SettlementTransaction } from "@finanzas/db/models";
import { createColumnHelper } from "@tanstack/react-table";
import dayjs from "dayjs";

import { fmtCLP } from "@/lib/format";

const columnHelper = createColumnHelper<SettlementTransaction>();

export const getSettlementColumns = () => [
  columnHelper.accessor("transactionDate", {
    header: "Fecha",
    cell: ({ getValue }) => (
      <span className="text-base-content font-medium">{dayjs(getValue()).format("DD/MM/YYYY")}</span>
    ),
  }),
  columnHelper.accessor("transactionType", {
    header: "Tipo",
  }),
  columnHelper.accessor("transactionAmount", {
    header: "Monto Transacción",
    cell: ({ getValue }) => fmtCLP(getValue()),
  }),
  columnHelper.accessor("settlementNetAmount", {
    header: "Monto Neto",
    cell: ({ getValue }) => <span className="font-semibold">{fmtCLP(getValue())}</span>,
  }),
  columnHelper.accessor("realAmount", {
    header: "Monto Real",
    cell: ({ getValue }) => fmtCLP(getValue()),
  }),
  columnHelper.accessor("couponAmount", {
    header: "Cupón",
    cell: ({ getValue }) => fmtCLP(getValue()),
  }),
  columnHelper.accessor("taxesAmount", {
    header: "Impuestos",
    cell: ({ getValue }) => fmtCLP(getValue()),
  }),
  columnHelper.accessor("installments", {
    header: "Cuotas",
  }),
];
