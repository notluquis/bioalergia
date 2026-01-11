import React, { useState } from "react";

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

  const sort = (column: T) => {
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
  };

  // eslint-disable-next-line sonarjs/function-return-type
  const getSortIcon = (column: T): React.ReactNode => {
    if (sortState.column !== column) return null;
    const symbol = sortState.direction === "asc" ? "▲" : "▼";
    return React.createElement("span", { className: "ml-1 text-xs opacity-60 align-middle select-none" }, symbol);
  };

  const getSortProps = (column: T) => ({
    onClick: () => sort(column),
    style: { cursor: "pointer" },
    title: `Ordenar por ${column}`,
  });

  return {
    sortState,
    sort,
    getSortIcon,
    getSortProps,
  };
}
