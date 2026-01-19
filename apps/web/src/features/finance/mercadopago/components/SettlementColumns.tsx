import type { SettlementTransaction } from "@finanzas/db/models";
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table";
import dayjs from "dayjs";

import { fmtCLP } from "@/lib/format";

const columnHelper = createColumnHelper<SettlementTransaction>();

// biome-ignore lint/suspicious/noExplicitAny: tanstack table generic
export const getSettlementColumns = (): ColumnDef<SettlementTransaction, any>[] => [
  columnHelper.accessor("transactionDate", {
    cell: ({ getValue }) => (
      <span className="text-base-content font-medium">
        {dayjs(getValue() as Date | string).format("DD/MM/YYYY")}
      </span>
    ),
    header: "Fecha",
  }),
  columnHelper.accessor("transactionType", {
    header: "Tipo",
  }),
  columnHelper.accessor("transactionAmount", {
    cell: ({ getValue }) => fmtCLP(getValue() as unknown as number),
    header: "Monto Transacción",
  }),
  columnHelper.accessor("settlementNetAmount", {
    cell: ({ getValue }) => (
      <span className="font-semibold">{fmtCLP(getValue() as unknown as number)}</span>
    ),
    header: "Monto Neto",
  }),
  columnHelper.accessor("realAmount", {
    cell: ({ getValue }) => fmtCLP(getValue() as unknown as number),
    header: "Monto Real",
  }),
  columnHelper.accessor("couponAmount", {
    cell: ({ getValue }) => fmtCLP(getValue() as unknown as number),
    header: "Cupón",
  }),
  columnHelper.accessor("taxesAmount", {
    cell: ({ getValue }) => fmtCLP(getValue() as unknown as number),
    header: "Impuestos",
  }),
  columnHelper.accessor("installments", {
    header: "Cuotas",
  }),
];
