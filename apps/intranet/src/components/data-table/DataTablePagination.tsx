import { Label, ListBox, Pagination, Select } from "@heroui/react";
import type { PaginationState, Table } from "@tanstack/react-table";

interface DataTablePaginationProps<TData> {
  readonly enablePageSizeSelector?: boolean;
  readonly pageCount?: number;
  readonly pageSizeOptions?: number[];
  readonly pagination?: PaginationState;
  readonly table: Table<TData>;
}

export function DataTablePagination<TData>({
  enablePageSizeSelector = true,
  pageCount,
  pageSizeOptions = [10, 25, 50],
  pagination,
  table,
}: DataTablePaginationProps<TData>) {
  const currentPagination = pagination ?? table.getState().pagination;
  const currentPageSize = currentPagination.pageSize;
  const currentPageIndex = currentPagination.pageIndex;
  const computedTotalPages = pageCount ?? table.getPageCount();
  const hasKnownTotalPages = computedTotalPages !== -1;
  const totalPages = hasKnownTotalPages ? Math.max(1, computedTotalPages) : currentPageIndex + 1;
  const canPrevious = currentPageIndex > 0;
  const canNext = !hasKnownTotalPages || currentPageIndex < totalPages - 1;
  const normalizedOptions = Array.from(new Set([...pageSizeOptions, currentPageSize])).sort(
    (a, b) => a - b,
  );
  const currentPageNumber = currentPageIndex + 1;

  const pageItems: Array<{ key: string; type: "ellipsis" | "page"; value?: number }> = [];
  let ellipsisCount = 0;
  const pushPage = (page: number) => {
    pageItems.push({ key: `page-${page}`, type: "page", value: page });
  };
  const pushEllipsis = () => {
    ellipsisCount += 1;
    pageItems.push({ key: `ellipsis-${ellipsisCount}`, type: "ellipsis" });
  };
  if (hasKnownTotalPages) {
    if (totalPages <= 7) {
      for (let page = 1; page <= totalPages; page += 1) {
        pushPage(page);
      }
    } else {
      pushPage(1);
      if (currentPageNumber > 3) {
        pushEllipsis();
      }
      const start = Math.max(2, currentPageNumber - 1);
      const end = Math.min(totalPages - 1, currentPageNumber + 1);
      for (let page = start; page <= end; page += 1) {
        pushPage(page);
      }
      if (currentPageNumber < totalPages - 2) {
        pushEllipsis();
      }
      pushPage(totalPages);
    }
  }

  return (
    <div className="flex flex-col items-start justify-between gap-3 px-2 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-2 text-default-500 text-sm">
        {enablePageSizeSelector && normalizedOptions.length > 1 && (
          <>
            <span className="font-medium text-xs uppercase tracking-wide">Filas</span>
            <Select
              aria-label="Filas por página"
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
      <Pagination className="w-full sm:w-auto" size="sm">
        <Pagination.Summary className="text-default-500 text-sm">
          {hasKnownTotalPages
            ? `Página ${currentPageNumber} de ${totalPages}`
            : `Página ${currentPageNumber}`}
        </Pagination.Summary>
        <Pagination.Content>
          <Pagination.Item>
            <Pagination.Previous
              isDisabled={!canPrevious}
              onPress={() => {
                table.setPageIndex(Math.max(0, currentPageIndex - 1));
              }}
            >
              <Pagination.PreviousIcon />
              <span>Anterior</span>
            </Pagination.Previous>
          </Pagination.Item>
          {hasKnownTotalPages
            ? pageItems.map((pageItem) =>
                pageItem.type === "ellipsis" ? (
                  <Pagination.Item key={pageItem.key}>
                    <Pagination.Ellipsis />
                  </Pagination.Item>
                ) : (
                  <Pagination.Item key={pageItem.key}>
                    <Pagination.Link
                      isActive={pageItem.value === currentPageNumber}
                      onPress={() => {
                        table.setPageIndex((pageItem.value ?? 1) - 1);
                      }}
                    >
                      {pageItem.value}
                    </Pagination.Link>
                  </Pagination.Item>
                ),
              )
            : null}
          <Pagination.Item>
            <Pagination.Next
              isDisabled={!canNext}
              onPress={() => {
                table.setPageIndex(currentPageIndex + 1);
              }}
            >
              <span>Siguiente</span>
              <Pagination.NextIcon />
            </Pagination.Next>
          </Pagination.Item>
        </Pagination.Content>
      </Pagination>
    </div>
  );
}
