import type { Table } from "@tanstack/react-table";
import { Download, X } from "lucide-react";
import Papa from "papaparse";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

import { DataTableFacetedFilter } from "./DataTableFacetedFilter";
import { DataTableViewOptions } from "./DataTableViewOptions";

export interface DataTableFilterOption {
  columnId: string;
  options: {
    icon?: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
  }[];
  title: string;
}

interface DataTableToolbarProps<TData> {
  /**
   * Enable CSV export
   */
  readonly enableExport?: boolean;
  /**
   * Enable global filtering (search across all columns)
   */
  readonly enableGlobalFilter?: boolean;
  /**
   * Faceted filters for specific columns
   */
  readonly filters?: DataTableFilterOption[];
  readonly table: Table<TData>;
}

export function DataTableToolbar<TData>({
  enableExport = true,
  enableGlobalFilter = true,
  filters = [],
  table,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;
  const globalFilter = table.getState().globalFilter as string | undefined;

  const handleExport = () => {
    // Get visible columns only (excluding actions/select)
    const columns = table
      .getAllColumns()
      .filter((col) => col.getIsVisible() && col.id !== "actions" && col.id !== "select")
      .map((col) => ({
        accessor: col.accessorFn,
        header: typeof col.columnDef.header === "string" ? col.columnDef.header : col.id,
        id: col.id,
      }));

    // Get all rows (respecting current filters/sorting)
    const rows = table.getPrePaginationRowModel().rows.map((row) => {
      const rowData: Record<string, boolean | null | number | string> = {};
      for (const col of columns) {
        // Use the cell value if possible
        const cellValue = row.getValue(col.id);
        rowData[col.header] = cellValue as boolean | null | number | string;
      }
      return rowData;
    });

    // Generate CSV with BOM for correct encoding in Excel/Spanish locales
    const csv = Papa.unparse(rows);
    const csvWithBOM = `\uFEFF${csv}`;
    const blob = new Blob([csvWithBOM], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `export-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.append(link);
    link.click();
    link.remove();
  };

  return (
    <div className="flex flex-col items-start justify-between gap-4 py-1 sm:flex-row sm:items-center">
      <div className="flex w-full flex-1 flex-col items-start space-y-2 sm:flex-row sm:items-center sm:space-x-2 sm:space-y-0">
        {enableGlobalFilter && (
          <Input
            className="h-9 w-full sm:w-62.5 lg:w-87.5"
            onChange={(event) => {
              table.setGlobalFilter(event.target.value);
            }}
            placeholder="Filtrar..."
            value={globalFilter ?? ""}
          />
        )}
        {filters.map((filter) => {
          const column = table.getColumn(filter.columnId);
          return (
            column && (
              <DataTableFacetedFilter
                column={column}
                key={filter.columnId}
                options={filter.options}
                title={filter.title}
              />
            )
          );
        })}
        {isFiltered && (
          <Button
            className="h-8 px-2 lg:px-3"
            onClick={() => {
              table.resetColumnFilters();
            }}
            variant="ghost"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
        {enableExport && (
          <Button className="h-8" onClick={handleExport} size="sm" variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        )}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
