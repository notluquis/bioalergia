import Checkbox from "@/components/ui/Checkbox";

import type { ColumnKey } from "../constants";
import { COLUMN_DEFS } from "../constants";

type Props = {
  visibleColumns: Set<ColumnKey>;
  onToggle: (column: ColumnKey) => void;
};

export function TransactionsColumnToggles({ visibleColumns, onToggle }: Props) {
  return (
    <div className="text-base-content/60 flex flex-wrap gap-3 text-xs">
      {COLUMN_DEFS.map((column) => (
        <Checkbox
          key={column.key}
          label={column.label}
          checked={visibleColumns.has(column.key)}
          onChange={() => onToggle(column.key)}
          className="border-base-300 bg-base-200 hover:border-base-300 hover:bg-base-200 rounded-full border px-4 py-1.5 shadow-sm"
        />
      ))}
    </div>
  );
}
