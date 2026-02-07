import { createColumnHelper } from "@tanstack/react-table";
import dayjs from "dayjs";

import { Button } from "@/components/ui/Button";
import type { Transaction } from "@/features/finance/types";
import { fmtCLP } from "@/lib/format";

import type { AccountGroup } from "./associated-accounts.helpers";

// --- Main Table: Account Groups ---

const accountGroupHelper = createColumnHelper<AccountGroup>();

export const getAccountGroupColumns = (
  summaryByGroup: Map<string, { count: number; total: number }>,
  _onConceptChange: (group: AccountGroup) => void,
  onQuickView: (group: AccountGroup) => void,
) => [
  accountGroupHelper.accessor("label", {
    cell: ({ row }) => {
      const group = row.original;
      const summaryInfo = summaryByGroup.get(group.key);
      return (
        <div className="flex flex-col gap-1">
          <div className="font-mono text-xs">{group.label}</div>
          {summaryInfo && summaryInfo.count > 0 && (
            <span className="mt-1 inline-flex w-fit rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary text-xs uppercase tracking-wide">
              Cuenta reconocida
            </span>
          )}
          {group.accounts.length > 1 && (
            <div className="text-foreground/90 text-xs">
              {group.accounts.length} cuentas vinculadas
            </div>
          )}
        </div>
      );
    },
    header: "Cuenta",
  }),
  accountGroupHelper.accessor("bankName", {
    cell: ({ getValue }) => getValue() ?? "-",
    header: "Banco",
  }),
  accountGroupHelper.display({
    cell: ({ row }) => {
      const group = row.original;
      const summaryInfo = summaryByGroup.get(group.key);
      return (
        <div className="flex flex-col gap-2 text-xs">
          <Button
            className="self-start"
            onClick={() => {
              onQuickView(group);
            }}
            size="xs"
            variant="secondary"
          >
            Ver movimientos
          </Button>
          <div className="text-default-500 text-xs">
            {summaryInfo
              ? `${summaryInfo.count} mov. · ${fmtCLP(summaryInfo.total)}`
              : "Sin movimientos en el rango"}
          </div>
        </div>
      );
    },
    header: "Movimientos",
    id: "actions",
  }),
];

// --- Detail Table: Quick View Transactions ---

const quickViewHelper = createColumnHelper<Transaction>();

export const getQuickViewColumns = () => [
  quickViewHelper.accessor("transactionDate", {
    cell: ({ getValue }) => dayjs(getValue()).format("DD MMM YYYY HH:mm"),
    header: "Fecha",
  }),
  quickViewHelper.accessor("description", {
    cell: ({ getValue }) => getValue() ?? "-",
    header: "Descripción",
  }),
  quickViewHelper.accessor("externalReference", {
    cell: ({ getValue }) => getValue() ?? "-",
    header: "Origen",
  }),
  quickViewHelper.accessor("transactionType", {
    cell: ({ getValue }) => getValue() || "-",
    header: "Destino",
  }),
  quickViewHelper.accessor("transactionAmount", {
    cell: ({ getValue }) => (
      <div className="text-right">{getValue() == null ? "-" : fmtCLP(getValue())}</div>
    ),

    header: () => <div className="text-right">Monto</div>,
  }),
];
