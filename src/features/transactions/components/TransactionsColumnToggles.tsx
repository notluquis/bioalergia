import Checkbox from "../../../components/Checkbox";
import type { ColumnKey } from "../constants";
import { COLUMN_DEFS } from "../constants";

type Props = {
  visibleColumns: Set<ColumnKey>;
  onToggle: (column: ColumnKey) => void;
};

export function TransactionsColumnToggles({ visibleColumns, onToggle }: Props) {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-base-content/60">
      {COLUMN_DEFS.map((column) => (
        <Checkbox
          key={column.key}
          label={column.label}
          checked={visibleColumns.has(column.key)}
          onChange={() => onToggle(column.key)}
          className="rounded-full border border-base-300 bg-base-200 px-4 py-1.5 shadow-sm hover:border-base-300 hover:bg-base-200"
        />
      ))}
    </div>
  );
}
