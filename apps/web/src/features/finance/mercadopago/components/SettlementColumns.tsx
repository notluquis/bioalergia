import type { SettlementTransaction } from "@finanzas/db/models";
import { createColumnHelper } from "@tanstack/react-table";
import dayjs from "dayjs";

import { fmtCLP } from "@/lib/format";

const columnHelper = createColumnHelper<SettlementTransaction>();

export const getSettlementColumns = () => [
  columnHelper.accessor("transactionDate", {
    cell: ({ getValue }) => (
      <span className="text-base-content font-medium">{dayjs(getValue()).format("DD/MM/YYYY")}</span>
    ),
    header: "Fecha",
  }),
  columnHelper.accessor("transactionType", {
    header: "Tipo",
  }),
  columnHelper.accessor("transactionAmount", {
    cell: ({ getValue }) => fmtCLP(getValue()),
    header: "Monto Transacción",
  }),
  columnHelper.accessor("settlementNetAmount", {
    cell: ({ getValue }) => <span className="font-semibold">{fmtCLP(getValue())}</span>,
    header: "Monto Neto",
  }),
  columnHelper.accessor("realAmount", {
    cell: ({ getValue }) => fmtCLP(getValue()),
    header: "Monto Real",
  }),
  columnHelper.accessor("couponAmount", {
    cell: ({ getValue }) => fmtCLP(getValue()),
    header: "Cupón",
  }),
  columnHelper.accessor("taxesAmount", {
    cell: ({ getValue }) => fmtCLP(getValue()),
    header: "Impuestos",
  }),
  columnHelper.accessor("installments", {
    header: "Cuotas",
  }),
];
