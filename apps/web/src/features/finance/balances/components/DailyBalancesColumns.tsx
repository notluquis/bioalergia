import type { ColumnDef, Row } from "@tanstack/react-table";
import dayjs from "dayjs";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { fmtCLP } from "@/lib/format";

import type { BalanceDraft, DailyBalanceDay } from "../types";

import { formatBalanceInput } from "../utils";

export interface BalanceTableMeta {
  drafts: Record<string, BalanceDraft>;
  onDraftChange: (date: string, patch: Partial<BalanceDraft>) => void;
  onSave: (date: string) => void;
  saving: Record<string, boolean>;
}

const formatDifference = (diff: null | number) => {
  if (diff == null) return "—";
  return diff >= 0 ? fmtCLP(diff) : `-${fmtCLP(Math.abs(diff))}`;
};

// Custom Cell for the "Registrado" Input
// biome-ignore lint/suspicious/noExplicitAny: tanstack generic
const RecordedBalanceCell = ({ row, table }: { row: Row<DailyBalanceDay>; table: any }) => {
  const meta = table.options.meta as BalanceTableMeta;
  const day = row.original;
  const draft = meta.drafts[day.date] ?? { note: "", value: "" };

  return (
    <Input
      className="input-xs w-28"
      inputMode="decimal"
      onChange={(event) => {
        meta.onDraftChange(day.date, { value: event.target.value });
      }}
      placeholder="0"
      type="text"
      value={draft.value}
    />
  );
};

// Custom Cell for the "Nota" Textarea
// biome-ignore lint/suspicious/noExplicitAny: tanstack generic
const NoteCell = ({ row, table }: { row: Row<DailyBalanceDay>; table: any }) => {
  const meta = table.options.meta as BalanceTableMeta;
  const day = row.original;
  const draft = meta.drafts[day.date] ?? { note: "", value: "" };

  return (
    <Input
      as="textarea"
      className="textarea-xs w-32 text-xs"
      onChange={(event) => {
        meta.onDraftChange(day.date, { note: event.target.value });
      }}
      placeholder="Nota"
      rows={1}
      value={draft.note}
    />
  );
};

// Custom Cell for Actions (Save Button)
// biome-ignore lint/suspicious/noExplicitAny: tanstack generic
const ActionsCell = ({ row, table }: { row: Row<DailyBalanceDay>; table: any }) => {
  const meta = table.options.meta as BalanceTableMeta;
  const day = row.original;
  const draft = meta.drafts[day.date] ?? { note: "", value: "" };
  const defaultValue = day.recordedBalance == null ? "" : formatBalanceInput(day.recordedBalance);
  const defaultNote = day.note ?? "";
  const isSaving = Boolean(meta.saving[day.date]);
  const isDirty = draft.value !== defaultValue || draft.note !== defaultNote;
  const hasValue = draft.value.trim().length > 0 || defaultValue.trim().length > 0;
  const canSave = isDirty && hasValue && !isSaving;

  return (
    <Button
      disabled={!canSave}
      onClick={() => {
        meta.onSave(day.date);
      }}
      size="xs"
      type="button"
    >
      {isSaving ? "..." : "💾"}
    </Button>
  );
};

export const columns: ColumnDef<DailyBalanceDay>[] = [
  {
    accessorKey: "date",
    cell: ({ row }) => (
      <div className="flex flex-col gap-0.5">
        <span>{dayjs(row.original.date).format("DD/MM/YY")}</span>
        {row.original.hasCashback && <span className="badge badge-warning badge-xs">CB</span>}
      </div>
    ),
    header: "Fecha",
  },
  {
    accessorKey: "totalIn",
    cell: ({ row }) => (
      <div className="text-success text-right text-xs">
        {fmtCLP(Math.abs(row.original.totalIn))}
      </div>
    ),
    header: () => <div className="text-right">Ingresos</div>,
  },
  {
    accessorKey: "totalOut",
    cell: ({ row }) => (
      <div className="text-error text-right text-xs">
        -{fmtCLP(Math.abs(row.original.totalOut))}
      </div>
    ),
    header: () => <div className="text-right">Egresos</div>,
  },
  {
    accessorKey: "netChange",
    cell: ({ row }) => {
      const val = row.original.netChange;
      return (
        <div
          className={`text-right text-xs font-semibold ${val >= 0 ? "text-success" : "text-error"}`}
        >
          {val >= 0 ? fmtCLP(val) : `-${fmtCLP(Math.abs(val))}`}
        </div>
      );
    },
    header: () => <div className="text-right">Neto</div>,
  },
  {
    accessorKey: "expectedBalance",
    cell: ({ row }) => (
      <div className="text-right text-xs">
        {row.original.expectedBalance == null ? "—" : fmtCLP(row.original.expectedBalance)}
      </div>
    ),
    header: () => <div className="text-right">Esperado</div>,
  },
  {
    cell: RecordedBalanceCell,
    header: "Registrado",
    id: "recordedBalance",
  },
  {
    accessorKey: "difference",
    cell: ({ row }) => {
      const mismatch = row.original.difference != null && Math.abs(row.original.difference) > 1;
      return (
        <div className={`text-right text-xs font-semibold ${mismatch ? "text-error" : ""}`}>
          {formatDifference(row.original.difference)}
        </div>
      );
    },
    header: () => <div className="text-right">Dif.</div>,
  },
  {
    cell: NoteCell,
    header: "Nota",
    id: "note",
  },
  {
    cell: ActionsCell,
    header: "",
    id: "actions",
  },
];
