import { useState } from "react";

export type ColumnVisibility = Record<string, boolean>;

export interface UseColumnVisibilityOptions {
  defaultVisible?: boolean;
  initialColumns?: string[];
}

export function useColumnVisibility({
  defaultVisible = true,
  initialColumns = [],
}: UseColumnVisibilityOptions = {}) {
  const [visibleColumns, setVisibleColumns] = useState<ColumnVisibility>(() => {
    return initialColumns.reduce<ColumnVisibility>((acc, col) => {
      acc[col] = defaultVisible;
      return acc;
    }, {});
  });

  const toggleColumn = (column: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [column]: !prev[column],
    }));
  };

  const showColumn = (column: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [column]: true,
    }));
  };

  const hideColumn = (column: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [column]: false,
    }));
  };

  const showAllColumns = () => {
    setVisibleColumns((prev) => {
      const updated = { ...prev };
      for (const key of Object.keys(updated)) {
        updated[key] = true;
      }
      return updated;
    });
  };

  const hideAllColumns = () => {
    setVisibleColumns((prev) => {
      const updated = { ...prev };
      for (const key of Object.keys(updated)) {
        updated[key] = false;
      }
      return updated;
    });
  };

  const isColumnVisible = (column: string) => {
    return visibleColumns[column] ?? true;
  };

  const getVisibleColumns = (allColumns: string[]) => {
    return allColumns.filter((col) => isColumnVisible(col));
  };

  return {
    getVisibleColumns,
    hideAllColumns,
    hideColumn,
    isColumnVisible,
    showAllColumns,
    showColumn,
    toggleColumn,
    visibleColumns,
  };
}
