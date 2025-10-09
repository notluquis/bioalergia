import dayjs from "dayjs";
import { useMemo } from "react";
import { useTable } from "../../../hooks";
import Button from "../../../components/Button";
import { fmtCLP } from "../../../lib/format";
import { COLUMN_DEFS, type ColumnKey } from "../constants";
import type { LedgerRow } from "../types";

type Props = {
  rows: LedgerRow[];
  loading: boolean;
  hasAmounts: boolean;
  total: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
};

export function TransactionsTable({ rows, loading, hasAmounts, total, onPageChange, onPageSizeChange }: Props) {
  const allColumns = COLUMN_DEFS.map((def) => def.key);

  const table = useTable<ColumnKey>({
    columns: allColumns,
    initialPageSize: 25,
    initialSortColumn: "date",
    initialSortDirection: "desc",
  });

  const visibleColumns = useMemo(() => {
    return COLUMN_DEFS.filter((column) => table.isColumnVisible(column.key));
  }, [table.visibleColumns]);

  const sortedRows = useMemo(() => {
    if (!table.sortState.column) return rows;

    return [...rows].sort((a, b) => {
      const { column, direction } = table.sortState;
      let aValue: any = a[column as keyof LedgerRow];
      let bValue: any = b[column as keyof LedgerRow];

      // Handle specific sorting logic
      if (column === "date") {
        aValue = new Date(a.timestamp).getTime();
        bValue = new Date(b.timestamp).getTime();
      } else if (column === "amount") {
        aValue = Number(a.amount) || 0;
        bValue = Number(b.amount) || 0;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        const result = aValue.localeCompare(bValue);
        return direction === "desc" ? -result : result;
      }

      if (aValue < bValue) return direction === "desc" ? 1 : -1;
      if (aValue > bValue) return direction === "desc" ? -1 : 1;
      return 0;
    });
  }, [rows, table.sortState]);

  const paginatedRows = useMemo(() => {
    const start = (table.pagination.page - 1) * table.pagination.pageSize;
    const end = start + table.pagination.pageSize;
    return sortedRows.slice(start, end);
  }, [sortedRows, table.pagination]);

  const pageInfo = table.getPageInfo(total);

  return (
    <div className="space-y-4">
      {/* Column visibility controls */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs font-semibold text-slate-600">Mostrar columnas:</span>
        {COLUMN_DEFS.map((column) => (
          <label key={column.key} className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={table.isColumnVisible(column.key)}
              onChange={() => table.toggleColumn(column.key)}
              className="rounded"
            />
            <span className="text-slate-600">{column.label}</span>
          </label>
        ))}
      </div>

      <div className="glass-card glass-underlay-gradient overflow-hidden">
        <div className="overflow-x-auto muted-scrollbar">
          <table className="min-w-full text-sm text-slate-600">
            <thead className="bg-white/55 text-[var(--brand-primary)] backdrop-blur-md">
              <tr>
                {visibleColumns.map((column) => (
                  <th
                    key={column.key}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide cursor-pointer hover:bg-white/70 whitespace-nowrap"
                    {...table.getSortProps(column.key)}
                  >
                    {column.label} {table.getSortIcon(column.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-white/40 bg-white/40 text-slate-700 transition-colors last:border-none even:bg-white/25 hover:bg-[var(--brand-primary)]/10"
                >
                  {visibleColumns.map((column) => (
                    <td key={column.key} className="px-4 py-3">
                      {renderCell(column.key, row, hasAmounts)}
                    </td>
                  ))}
                </tr>
              ))}
              {!rows.length && !loading && (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-4 py-6 text-center text-slate-500">
                    No hay resultados con los filtros actuales.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-4 py-6 text-center text-[var(--brand-primary)]">
                    Cargando movimientos...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/40 bg-white/45 px-4 py-3 text-xs text-slate-600">
          <div className="font-semibold text-slate-600/90">
            Página {pageInfo.start} - {pageInfo.end} de {pageInfo.total} movimientos
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span>Tamaño de página</span>
              <select
                value={table.pagination.pageSize}
                onChange={(event) => {
                  const newSize = Number(event.target.value);
                  table.setPageSize(newSize);
                  onPageSizeChange?.(newSize);
                }}
                className="glass-input py-1 text-xs"
              >
                {table.pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={() => {
                  table.prevPage();
                  onPageChange?.(table.pagination.page - 1);
                }}
                disabled={!table.canGoPrev() || loading}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={() => {
                  table.nextPage();
                  onPageChange?.(table.pagination.page + 1);
                }}
                disabled={!table.canGoNext(total) || loading}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderCell(key: ColumnKey, row: LedgerRow, hasAmounts: boolean) {
  switch (key) {
    case "date":
      return dayjs(row.timestamp).format("DD/MM");
    case "time":
      return dayjs(row.timestamp).format("HH:mm");
    case "description":
      return (
        <span title={row.description || undefined} className="block max-w-xs truncate">
          {row.description}
        </span>
      );
    case "source_id":
      return row.source_id || "—";
    case "origin":
      return (
        <span title={row.origin || undefined} className="block max-w-xs truncate">
          {row.origin || "—"}
        </span>
      );
    case "destination":
      return (
        <span title={row.destination || undefined} className="block max-w-xs truncate">
          {row.destination || "—"}
        </span>
      );
    case "direction":
      return (
        <span
          className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
            row.direction === "IN"
              ? "bg-emerald-100 text-emerald-700"
              : row.direction === "OUT"
                ? "bg-rose-100 text-rose-700"
                : "bg-gray-100 text-gray-700"
          }`}
        >
          {row.direction === "IN" ? "Entrada" : row.direction === "OUT" ? "Salida" : "Neutro"}
        </span>
      );
    case "amount":
      if (!hasAmounts) return "—";
      return (
        <span className={row.direction === "IN" ? "text-emerald-600" : "text-rose-600"}>{fmtCLP(row.amount || 0)}</span>
      );
    case "runningBalance":
      if (!hasAmounts || !row.runningBalance) return "—";
      return <span className="font-medium text-slate-700">{fmtCLP(row.runningBalance)}</span>;
    default:
      return "—";
  }
}
