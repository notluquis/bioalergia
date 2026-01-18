import { type ColumnVisibility, useColumnVisibility } from "./useColumnVisibility";
import { type PaginationState, usePagination } from "./usePagination";
import { type SortState, useSorting } from "./useSorting";

export interface TableState<T extends string = string> {
  columnVisibility: ColumnVisibility;
  pagination: PaginationState;
  sorting: SortState<T>;
}

export interface UseTableOptions<T extends string> {
  // Column visibility options
  columns?: T[];
  defaultColumnVisible?: boolean;
  // Pagination options
  initialPage?: number;

  initialPageSize?: number;
  // Sorting options
  initialSortColumn?: null | T;

  initialSortDirection?: "asc" | "desc";
  pageSizeOptions?: number[];
}

export function useTable<T extends string>({
  columns = [],
  defaultColumnVisible = true,
  initialPage = 1,
  initialPageSize = 25,
  initialSortColumn = null,
  initialSortDirection = "asc",
  pageSizeOptions = [10, 25, 50, 100],
}: UseTableOptions<T> = {}) {
  const pagination = usePagination({
    initialPage,
    initialPageSize,
    pageSizeOptions,
  });

  const sorting = useSorting({
    initialColumn: initialSortColumn,
    initialDirection: initialSortDirection,
  });

  const columnVisibility = useColumnVisibility({
    defaultVisible: defaultColumnVisible,
    initialColumns: columns,
  });

  const state: TableState<T> = {
    columnVisibility: columnVisibility.visibleColumns,
    pagination: pagination.pagination,
    sorting: sorting.sortState,
  };

  return {
    // Combined state
    state,

    // Pagination
    ...pagination,

    // Sorting
    ...sorting,

    // Column visibility
    ...columnVisibility,
  };
}
