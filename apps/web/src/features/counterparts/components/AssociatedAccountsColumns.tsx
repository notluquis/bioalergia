import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { FocusEvent } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Transaction } from "@/features/finance/types";
import { fmtCLP } from "@/lib/format";

import { AccountGroup } from "./AssociatedAccounts.helpers";

// --- Main Table: Account Groups ---

export const getAccountGroupColumns = (
  summaryByGroup: Map<string, { total: number; count: number }>,
  onConceptChange: (group: AccountGroup, concept: string) => void,
  onQuickView: (group: AccountGroup) => void
): ColumnDef<AccountGroup>[] => [
  {
    accessorKey: "label",
    header: "Cuenta",
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
  },
  {
    accessorKey: "bankName",
    header: "Banco",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "holder",
    header: "Titular",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "concept",
    header: "Concepto",
    cell: ({ row }) => {
      const group = row.original;
      const summaryInfo = summaryByGroup.get(group.key);

      if (!summaryInfo || summaryInfo.count === 0) {
        return <span className="text-base-content/60 text-xs italic">Sin movimientos</span>;
      }

      return (
        <Input
          type="text"
          defaultValue={group.concept}
          onBlur={(event: FocusEvent<HTMLInputElement>) => onConceptChange(group, event.target.value)}
          className="w-full"
          placeholder="Concepto (ej. Compra de vacunas)"
        />
      );
    },
  },
  {
    id: "actions",
    header: "Movimientos",
    cell: ({ row }) => {
      const group = row.original;
      const summaryInfo = summaryByGroup.get(group.key);
      return (
        <div className="flex flex-col gap-2 text-xs">
          <Button variant="secondary" onClick={() => onQuickView(group)} className="self-start" size="xs">
            Ver movimientos
          </Button>
          <div className="text-base-content/60 text-xs">
            {summaryInfo ? `${summaryInfo.count} mov. · ${fmtCLP(summaryInfo.total)}` : "Sin movimientos en el rango"}
          </div>
        </div>
      );
    },
  },
];

// --- Detail Table: Quick View Transactions ---

export const getQuickViewColumns = (): ColumnDef<Transaction>[] => [
  {
    accessorKey: "transactionDate",
    header: "Fecha",
    cell: ({ getValue }) => dayjs(getValue() as string).format("DD MMM YYYY HH:mm"),
  },
  {
    accessorKey: "description",
    header: "Descripción",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "externalReference",
    header: "Origen",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "transactionType",
    header: "Destino",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "transactionAmount",
    header: () => <div className="text-right">Monto</div>,
    cell: ({ getValue }) => <div className="text-right">{getValue() == null ? "-" : fmtCLP(getValue() as number)}</div>,
  },
];
