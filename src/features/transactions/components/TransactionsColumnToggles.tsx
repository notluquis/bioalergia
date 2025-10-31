import Checkbox from "../../../components/Checkbox";
import type { ColumnKey } from "../constants";
import { COLUMN_DEFS } from "../constants";

type Props = {
  visibleColumns: Set<ColumnKey>;
  onToggle: (column: ColumnKey) => void;
};

export function TransactionsColumnToggles({ visibleColumns, onToggle }: Props) {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
      {COLUMN_DEFS.map((column) => (
        <Checkbox
          key={column.key}
          label={column.label}
          checked={visibleColumns.has(column.key)}
          onChange={() => onToggle(column.key)}
            className="rounded-full border border-white/55 bg-base-100/55 px-4 py-1.5 shadow-[0_8px_16px_-12px_rgba(16,37,66,0.4)] hover:border-white/70 hover:bg-base-100/70"
        />
      ))}
    </div>
  );
}
