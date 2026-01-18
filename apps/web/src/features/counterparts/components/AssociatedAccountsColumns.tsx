import { createColumnHelper } from "@tanstack/react-table";
import dayjs from "dayjs";
import { FocusEvent } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Transaction } from "@/features/finance/types";
import { fmtCLP } from "@/lib/format";

import { AccountGroup } from "./associated-accounts.helpers";

// --- Main Table: Account Groups ---

const accountGroupHelper = createColumnHelper<AccountGroup>();

export const getAccountGroupColumns = (
  summaryByGroup: Map<string, { count: number; total: number }>,
  onConceptChange: (group: AccountGroup, concept: string) => void,
  onQuickView: (group: AccountGroup) => void
) => [
  accountGroupHelper.accessor("label", {
    cell: ({ row }) => {
      const group = row.original;
      const summaryInfo = summaryByGroup.get(group.key);
      return (
        <div className="flex flex-col gap-1">
          <div className="font-mono text-xs">{group.label}</div>
          {summaryInfo && summaryInfo.count > 0 && (
            <span className="bg-primary/15 text-primary mt-1 inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-semibold tracking-wide uppercase">
              Cuenta reconocida
            </span>
          )}
          {group.accounts.length > 1 && (
            <div className="text-base-content/90 text-xs">{group.accounts.length} identificadores vinculados</div>
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
  accountGroupHelper.accessor("holder", {
    cell: ({ getValue }) => getValue() ?? "-",
    header: "Titular",
  }),
  accountGroupHelper.accessor("concept", {
    cell: ({ row }) => {
      const group = row.original;
      const summaryInfo = summaryByGroup.get(group.key);

      if (!summaryInfo || summaryInfo.count === 0) {
        return <span className="text-base-content/60 text-xs italic">Sin movimientos</span>;
      }

      return (
        <Input
          className="w-full"
          defaultValue={group.concept}
          onBlur={(event: FocusEvent<HTMLInputElement>) => {
            onConceptChange(group, event.target.value);
          }}
          placeholder="Concepto (ej. Compra de vacunas)"
          type="text"
        />
      );
    },
    header: "Concepto",
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
          <div className="text-base-content/60 text-xs">
            {summaryInfo ? `${summaryInfo.count} mov. · ${fmtCLP(summaryInfo.total)}` : "Sin movimientos en el rango"}
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
    cell: ({ getValue }) => <div className="text-right">{getValue() == null ? "-" : fmtCLP(getValue())}</div>,
    header: () => <div className="text-right">Monto</div>,
  }),
];
