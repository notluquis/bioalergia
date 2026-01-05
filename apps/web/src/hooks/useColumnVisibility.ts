import { useState } from "react";

export interface ColumnVisibility {
  [key: string]: boolean;
}

export interface UseColumnVisibilityOptions {
  initialColumns?: string[];
  defaultVisible?: boolean;
}

export function useColumnVisibility({ initialColumns = [], defaultVisible = true }: UseColumnVisibilityOptions = {}) {
  const [visibleColumns, setVisibleColumns] = useState<ColumnVisibility>(() => {
    return initialColumns.reduce((acc, col) => {
      acc[col] = defaultVisible;
      return acc;
    }, {} as ColumnVisibility);
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
      Object.keys(updated).forEach((key) => {
        updated[key] = true;
      });
      return updated;
    });
  };

  const hideAllColumns = () => {
    setVisibleColumns((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((key) => {
        updated[key] = false;
      });
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
    visibleColumns,
    toggleColumn,
    showColumn,
    hideColumn,
    showAllColumns,
    hideAllColumns,
    isColumnVisible,
    getVisibleColumns,
  };
}
