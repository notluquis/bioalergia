import { Label, ListBox, Select } from "@heroui/react";
import type { PaginationState, Table } from "@tanstack/react-table";
import { AppPagination } from "@/components/pagination/AppPagination";
import { normalizePageSizeOptions } from "./pagination-utils";

interface DataTablePaginationProps<TData> {
  readonly enablePageSizeSelector?: boolean;
  readonly pageCount?: number;
  readonly pageSizeOptions?: number[];
  readonly pagination?: PaginationState;
  readonly table: Table<TData>;
  /** Total de filas filtradas (client-side) computado en el padre. */
  readonly totalRows?: number;
}

export function DataTablePagination<TData>({
  enablePageSizeSelector = true,
  pageCount,
  pageSizeOptions = [10, 25, 50],
  pagination,
  table,
  totalRows,
}: DataTablePaginationProps<TData>) {
  const currentPagination = pagination ?? table.getState().pagination;
  const currentPageSize = currentPagination.pageSize;
  // Derivamos el nº de páginas del conteo real de filas (determinístico).
  // `pageCount` (server-side) manda; si no, `totalRows/pageSize`; último
  // fallback `table.getPageCount()` que puede dar 1/-1 en ciertos estados y
  // ocultar la paginación aunque haya miles de filas.
  const computedTotalPages =
    pageCount ??
    (totalRows !== undefined
      ? Math.max(1, Math.ceil(totalRows / Math.max(1, currentPageSize)))
      : table.getPageCount());
  const normalizedOptions = normalizePageSizeOptions(pageSizeOptions, currentPageSize);

  return (
    <div className="flex flex-col items-start justify-between gap-3 px-2 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-2 text-default-500 text-sm">
        {enablePageSizeSelector && normalizedOptions.length > 1 && (
          <>
            <span className="font-medium text-xs uppercase tracking-wide">Filas</span>
            <Select
              className="w-24"
              value={String(currentPageSize)}
              onChange={(key) => {
                const nextSize = Number(key);
                if (!Number.isNaN(nextSize)) {
                  table.setPageSize(nextSize);
                  table.setPageIndex(0);
                }
              }}
              variant="secondary"
            >
              <Label className="sr-only">Filas por página</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {normalizedOptions.map((size) => (
                    <ListBox.Item id={String(size)} key={size}>
                      {size}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </>
        )}
      </div>
      <AppPagination
        className="w-full sm:w-auto"
        onPageChange={(p) => table.setPageIndex(p)}
        page={currentPagination.pageIndex}
        pageSize={currentPageSize}
        totalPages={computedTotalPages}
      />
    </div>
  );
}
