import type { Table } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import Button from "@/components/ui/Button";
import { Select, SelectItem } from "@/components/ui/Select";

interface DataTablePaginationProps<TData> {
  readonly enablePageSizeSelector?: boolean;
  readonly pageSizeOptions?: number[];
  readonly table: Table<TData>;
}

export function DataTablePagination<TData>({
  enablePageSizeSelector = true,
  pageSizeOptions = [10, 25, 50],
  table,
}: DataTablePaginationProps<TData>) {
  const currentPageSize = table.getState().pagination.pageSize;
  const normalizedOptions = Array.from(new Set([...pageSizeOptions, currentPageSize])).sort(
    (a, b) => a - b,
  );

  return (
    <div className="flex flex-col items-start justify-between gap-3 px-2 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-2 text-sm text-default-500">
        {enablePageSizeSelector && normalizedOptions.length > 1 && (
          <>
            <span className="text-xs font-medium uppercase tracking-wide">Filas</span>
            <Select
              aria-label="Filas por página"
              className="w-24"
              selectedKey={String(currentPageSize)}
              onSelectionChange={(key) => {
                const nextSize = Number(key);
                if (!Number.isNaN(nextSize)) {
                  table.setPageSize(nextSize);
                  table.setPageIndex(0);
                }
              }}
              variant="secondary"
            >
              {normalizedOptions.map((size) => (
                <SelectItem id={String(size)} key={size}>
                  {size}
                </SelectItem>
              ))}
            </Select>
          </>
        )}
      </div>
      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center justify-center text-sm font-medium">
          Página {table.getState().pagination.pageIndex + 1} de {Math.max(1, table.getPageCount())}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            className="hidden h-8 w-8 p-0 lg:flex"
            disabled={!table.getCanPreviousPage()}
            onClick={() => {
              table.setPageIndex(0);
            }}
            variant="outline"
          >
            <span className="sr-only">Ir a la primera página</span>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            className="h-8 w-8 p-0"
            disabled={!table.getCanPreviousPage()}
            onClick={() => {
              table.previousPage();
            }}
            variant="outline"
          >
            <span className="sr-only">Página anterior</span>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            className="h-8 w-8 p-0"
            disabled={!table.getCanNextPage()}
            onClick={() => {
              table.nextPage();
            }}
            variant="outline"
          >
            <span className="sr-only">Página siguiente</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            className="hidden h-8 w-8 p-0 lg:flex"
            disabled={!table.getCanNextPage()}
            onClick={() => {
              table.setPageIndex(table.getPageCount() - 1);
            }}
            variant="outline"
          >
            <span className="sr-only">Ir a la última página</span>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
