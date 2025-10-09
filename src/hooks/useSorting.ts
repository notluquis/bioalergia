import React, { useState, useCallback } from "react";

export type SortDirection = "asc" | "desc";

export interface SortState<T = string> {
  column: T | null;
  direction: SortDirection;
}

export interface UseSortingOptions<T> {
  initialColumn?: T | null;
  initialDirection?: SortDirection;
}

export function useSorting<T extends string>({
  initialColumn = null,
  initialDirection = "asc",
}: UseSortingOptions<T> = {}) {
  const [sortState, setSortState] = useState<SortState<T>>({
    column: initialColumn,
    direction: initialDirection,
  });

  const sort = useCallback((column: T) => {
    setSortState((prev) => {
      if (prev.column === column) {
        // Cycle: asc -> desc -> none
        if (prev.direction === "asc") {
          return { column, direction: "desc" };
        } else if (prev.direction === "desc") {
          return { column: null, direction: "asc" };
        }
      }
      return { column, direction: "asc" };
    });
  }, []);

  const getSortIcon = useCallback(
    (column: T): React.ReactNode => {
      if (sortState.column !== column) return null;
      const symbol = sortState.direction === "asc" ? "▲" : "▼";
      return React.createElement("span", { className: "ml-1 text-[10px] opacity-60 align-middle select-none" }, symbol);
    },
    [sortState]
  );

  const getSortProps = useCallback(
    (column: T) => ({
      onClick: () => sort(column),
      style: { cursor: "pointer" },
      title: `Ordenar por ${column}`,
    }),
    [sort]
  );

  return {
    sortState,
    sort,
    getSortIcon,
    getSortProps,
  };
}
