import { ColumnDef, Row } from "@tanstack/react-table";
import dayjs from "dayjs";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { fmtCLP } from "@/lib/format";

import type { BalanceDraft, DailyBalanceDay } from "../types";
import { formatBalanceInput } from "../utils";

export interface BalanceTableMeta {
  drafts: Record<string, BalanceDraft>;
  saving: Record<string, boolean>;
  onDraftChange: (date: string, patch: Partial<BalanceDraft>) => void;
  onSave: (date: string) => void;
}

const formatDifference = (diff: number | null) => {
  if (diff == null) return "—";
  return diff >= 0 ? fmtCLP(diff) : `-${fmtCLP(Math.abs(diff))}`;
};

// Custom Cell for the "Registrado" Input
const RecordedBalanceCell = ({ row, table }: { row: Row<DailyBalanceDay>; table: any }) => {
  const meta = table.options.meta as BalanceTableMeta;
  const day = row.original;
  const draft = meta.drafts[day.date] ?? { value: "", note: "" };

  return (
    <Input
      type="text"
      value={draft.value}
      onChange={(event) => meta.onDraftChange(day.date, { value: event.target.value })}
      className="input-xs w-28"
      placeholder="0"
      inputMode="decimal"
    />
  );
};

// Custom Cell for the "Nota" Textarea
const NoteCell = ({ row, table }: { row: Row<DailyBalanceDay>; table: any }) => {
  const meta = table.options.meta as BalanceTableMeta;
  const day = row.original;
  const draft = meta.drafts[day.date] ?? { value: "", note: "" };

  return (
    <Input
      as="textarea"
      rows={1}
      value={draft.note}
      onChange={(event) => meta.onDraftChange(day.date, { note: event.target.value })}
      className="textarea-xs w-32 text-xs"
      placeholder="Nota"
    />
  );
};

// Custom Cell for Actions (Save Button)
const ActionsCell = ({ row, table }: { row: Row<DailyBalanceDay>; table: any }) => {
  const meta = table.options.meta as BalanceTableMeta;
  const day = row.original;
  const draft = meta.drafts[day.date] ?? { value: "", note: "" };
  const defaultValue = day.recordedBalance == null ? "" : formatBalanceInput(day.recordedBalance);
  const defaultNote = day.note ?? "";
  const isSaving = Boolean(meta.saving[day.date]);
  const isDirty = draft.value !== defaultValue || draft.note !== defaultNote;
  const hasValue = draft.value.trim().length > 0 || defaultValue.trim().length > 0;
  const canSave = isDirty && hasValue && !isSaving;

  return (
    <Button type="button" size="xs" onClick={() => meta.onSave(day.date)} disabled={!canSave}>
      {isSaving ? "..." : "💾"}
    </Button>
  );
};

export const columns: ColumnDef<DailyBalanceDay>[] = [
  {
    accessorKey: "date",
    header: "Fecha",
    cell: ({ row }) => (
      <div className="flex flex-col gap-0.5">
        <span>{dayjs(row.original.date).format("DD/MM/YY")}</span>
        {row.original.hasCashback && <span className="badge badge-warning badge-xs">CB</span>}
      </div>
    ),
  },
  {
    accessorKey: "totalIn",
    header: () => <div className="text-right">Ingresos</div>,
    cell: ({ row }) => <div className="text-success text-right text-xs">{fmtCLP(Math.abs(row.original.totalIn))}</div>,
  },
  {
    accessorKey: "totalOut",
    header: () => <div className="text-right">Egresos</div>,
    cell: ({ row }) => <div className="text-error text-right text-xs">-{fmtCLP(Math.abs(row.original.totalOut))}</div>,
  },
  {
    accessorKey: "netChange",
    header: () => <div className="text-right">Neto</div>,
    cell: ({ row }) => {
      const val = row.original.netChange;
      return (
        <div className={`text-right text-xs font-semibold ${val >= 0 ? "text-success" : "text-error"}`}>
          {val >= 0 ? fmtCLP(val) : `-${fmtCLP(Math.abs(val))}`}
        </div>
      );
    },
  },
  {
    accessorKey: "expectedBalance",
    header: () => <div className="text-right">Esperado</div>,
    cell: ({ row }) => (
      <div className="text-right text-xs">
        {row.original.expectedBalance == null ? "—" : fmtCLP(row.original.expectedBalance)}
      </div>
    ),
  },
  {
    id: "recordedBalance",
    header: "Registrado",
    cell: RecordedBalanceCell,
  },
  {
    accessorKey: "difference",
    header: () => <div className="text-right">Dif.</div>,
    cell: ({ row }) => {
      const mismatch = row.original.difference != null && Math.abs(row.original.difference) > 1;
      return (
        <div className={`text-right text-xs font-semibold ${mismatch ? "text-error" : ""}`}>
          {formatDifference(row.original.difference)}
        </div>
      );
    },
  },
  {
    id: "note",
    header: "Nota",
    cell: NoteCell,
  },
  {
    id: "actions",
    header: "",
    cell: ActionsCell,
  },
];
