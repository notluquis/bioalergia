import { useState, useCallback } from "react";

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

  const toggleColumn = useCallback((column: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [column]: !prev[column],
    }));
  }, []);

  const showColumn = useCallback((column: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [column]: true,
    }));
  }, []);

  const hideColumn = useCallback((column: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [column]: false,
    }));
  }, []);

  const showAllColumns = useCallback(() => {
    setVisibleColumns((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((key) => {
        updated[key] = true;
      });
      return updated;
    });
  }, []);

  const hideAllColumns = useCallback(() => {
    setVisibleColumns((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((key) => {
        updated[key] = false;
      });
      return updated;
    });
  }, []);

  const isColumnVisible = useCallback(
    (column: string) => {
      return visibleColumns[column] ?? true;
    },
    [visibleColumns]
  );

  const getVisibleColumns = useCallback(
    (allColumns: string[]) => {
      return allColumns.filter((col) => isColumnVisible(col));
    },
    [isColumnVisible]
  );

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
