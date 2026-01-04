import dayjs from "dayjs";
import { memo, useMemo } from "react";

import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import { useTable } from "@/hooks/useTable";
import { fmtCLP } from "@/lib/format";

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

export const TransactionsTable = memo(function TransactionsTable({
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
    initialSortColumn: "transactionDate",
    initialSortDirection: "desc",
  });

  const {
    sortState,
    pageSizeOptions: tablePageSizeOptions,
    toggleColumn,
    getSortProps,
    getSortIcon,
    isColumnVisible,
  } = table;

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

      if (column === "transactionDate") {
        firstValue = new Date(a.transactionDate).getTime();
        secondValue = new Date(b.transactionDate).getTime();
      } else if (column === "transactionAmount" || column === "settlementNetAmount" || column === "runningBalance") {
        firstValue = Number(a[column as keyof LedgerRow] ?? 0);
        secondValue = Number(b[column as keyof LedgerRow] ?? 0);
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
        <span className="text-base-content text-xs font-semibold">Mostrar columnas:</span>
        {COLUMN_DEFS.map((column) => (
          <Checkbox
            key={column.key}
            checked={isColumnVisible(column.key)}
            onChange={() => toggleColumn(column.key)}
            className="text-xs"
            label={column.label}
          />
        ))}
      </div>

      <div className="bg-base-100 overflow-hidden">
        <div className="muted-scrollbar overflow-x-auto">
          <table className="text-base-content min-w-full text-sm">
            <thead className="bg-base-100/55 text-primary backdrop-blur-md">
              <tr>
                {visibleColumns.map((column) => (
                  <th
                    key={column.key}
                    className="hover:bg-base-100/70 cursor-pointer px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap uppercase"
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
                  className="border-base-300 bg-base-200 text-base-content even:bg-base-300 hover:bg-primary/10 border-b transition-colors last:border-none"
                >
                  {visibleColumns.map((column) => (
                    <td key={column.key} className="px-4 py-3 whitespace-nowrap">
                      {renderCell(column.key, row, hasAmounts)}
                    </td>
                  ))}
                </tr>
              ))}
              {!rows.length && !loading && (
                <tr>
                  <td colSpan={visibleColumns.length} className="text-base-content/60 px-4 py-6 text-center">
                    No hay resultados con los filtros actuales.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={visibleColumns.length} className="text-primary px-4 py-6 text-center">
                    Cargando movimientos...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="border-base-300 bg-base-200 text-base-content flex flex-wrap items-center justify-between gap-4 border-t px-4 py-3 text-xs">
          <div className="text-base-content/90 font-semibold">
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
                className="select select-bordered py-1 text-xs"
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
});

function renderCell(key: ColumnKey, row: LedgerRow, hasAmounts: boolean) {
  if (!row) return "—";

  // Format Amounts
  if (
    key === "transactionAmount" ||
    key === "settlementNetAmount" ||
    key === "feeAmount" ||
    key === "taxesAmount" ||
    key === "couponAmount" ||
    key === "shippingFeeAmount" ||
    key === "financingFeeAmount" ||
    key === "totalCouponAmount" ||
    key === "sellerAmount" ||
    key === "mkpFeeAmount" ||
    key === "tipAmount" ||
    key === "realAmount"
  ) {
    if (!hasAmounts) return "—";
    const value = row[key as keyof LedgerRow] as number | null;
    if (value === null || value === undefined) return "—";
    // Colorize main amount
    if (key === "transactionAmount") {
      return <span className={value >= 0 ? "text-success" : "text-error"}>{fmtCLP(value)}</span>;
    }
    return fmtCLP(value);
  }

  // Format Running Balance
  if (key === "runningBalance") {
    if (!hasAmounts || !row.runningBalance) return "—";
    return <span className="text-base-content font-medium">{fmtCLP(row.runningBalance)}</span>;
  }

  // Format Dates
  if (key === "transactionDate" || key === "moneyReleaseDate" || key === "settlementDate") {
    const val = row[key as keyof LedgerRow] as string | null;
    if (!val) return "—";
    return dayjs(val).format("DD/MM/YYYY HH:mm");
  }

  // Format Boolean
  if (key === "isReleased") {
    return row.isReleased ? "Sí" : "No";
  }

  // Default String rendering
  const value = row[key as keyof LedgerRow];
  if (value === null || value === undefined) return "—";

  const strVal = String(value);
  return (
    <span title={strVal} className="block max-w-xs truncate">
      {strVal}
    </span>
  );
}
