import { usePagination, type PaginationState } from "./usePagination";
import { useSorting, type SortState } from "./useSorting";
import { useColumnVisibility, type ColumnVisibility } from "./useColumnVisibility";

export interface TableState<T extends string = string> {
  pagination: PaginationState;
  sorting: SortState<T>;
  columnVisibility: ColumnVisibility;
}

export interface UseTableOptions<T extends string> {
  // Pagination options
  initialPage?: number;
  initialPageSize?: number;
  pageSizeOptions?: number[];

  // Sorting options
  initialSortColumn?: T | null;
  initialSortDirection?: "asc" | "desc";

  // Column visibility options
  columns?: T[];
  defaultColumnVisible?: boolean;
}

export function useTable<T extends string>({
  initialPage = 1,
  initialPageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  initialSortColumn = null,
  initialSortDirection = "asc",
  columns = [],
  defaultColumnVisible = true,
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
    initialColumns: columns,
    defaultVisible: defaultColumnVisible,
  });

  const state: TableState<T> = {
    pagination: pagination.pagination,
    sorting: sorting.sortState,
    columnVisibility: columnVisibility.visibleColumns,
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
