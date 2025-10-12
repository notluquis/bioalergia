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
  page: number;
  pageSize: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
};

export function TransactionsTable({
  rows,
  loading,
  hasAmounts,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const allColumns = COLUMN_DEFS.map((def) => def.key);

  const table = useTable<ColumnKey>({
    columns: allColumns,
    initialPageSize: pageSize,
    initialSortColumn: "date",
    initialSortDirection: "desc",
  });

  const { sortState, pageSizeOptions: tablePageSizeOptions, toggleColumn, getSortProps, getSortIcon, isColumnVisible } =
    table;

  const visibleColumns = useMemo(() => {
    return COLUMN_DEFS.filter((column) => isColumnVisible(column.key));
  }, [isColumnVisible]);

  const sortedRows = useMemo(() => {
    if (!sortState.column) return rows;

    const { column, direction } = sortState;

    const compare = (first: unknown, second: unknown) => {
      if (typeof first === "number" && typeof second === "number") {
        if (first === second) return 0;
        return first < second ? -1 : 1;
      }
      const firstString = String(first ?? "");
      const secondString = String(second ?? "");
      return firstString.localeCompare(secondString);
    };

    return [...rows].sort((a, b) => {
      let firstValue: unknown = a[column as keyof LedgerRow];
      let secondValue: unknown = b[column as keyof LedgerRow];

      if (column === "date") {
        firstValue = new Date(a.timestamp).getTime();
        secondValue = new Date(b.timestamp).getTime();
      } else if (column === "amount") {
        firstValue = Number(a.amount ?? 0);
        secondValue = Number(b.amount ?? 0);
      }

      const baseComparison = compare(firstValue, secondValue);
      return direction === "desc" ? -baseComparison : baseComparison;
    });
  }, [rows, sortState]);

  const pageInfo = useMemo(() => {
    if (total === 0) {
      return { start: 0, end: 0, totalPages: 0, total: 0 };
    }
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(Math.max(page, 1), totalPages);
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, total);
    return { start, end, totalPages, total };
  }, [total, page, pageSize]);

  const handlePrevClick = () => {
    if (page <= 1 || !onPageChange) return;
    onPageChange(page - 1);
  };

  const handleNextClick = () => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (page >= totalPages || !onPageChange) return;
    onPageChange(page + 1);
  };

  const handlePageSizeChange = (newSize: number) => {
    onPageSizeChange?.(newSize);
  };

  const canGoPrev = page > 1;
  const canGoNext = page * pageSize < total;

  const displayedRows = sortedRows;

  return (
    <div className="space-y-4">
      {/* Column visibility controls */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs font-semibold text-slate-600">Mostrar columnas:</span>
        {COLUMN_DEFS.map((column) => (
          <label key={column.key} className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={isColumnVisible(column.key)}
              onChange={() => toggleColumn(column.key)}
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
                    {...getSortProps(column.key)}
                  >
                    {column.label} {getSortIcon(column.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((row) => (
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
                value={pageSize}
                onChange={(event) => {
                  const newSize = Number(event.target.value);
                  handlePageSizeChange(newSize);
                }}
                className="glass-input py-1 text-xs"
              >
                {tablePageSizeOptions.map((size) => (
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
                onClick={handlePrevClick}
                disabled={!canGoPrev || loading}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={handleNextClick}
                disabled={!canGoNext || loading}
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
