import { Table } from "@tanstack/react-table";
import { Download, X } from "lucide-react";
import Papa from "papaparse";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import { DataTableFacetedFilter } from "./DataTableFacetedFilter";
import { DataTableViewOptions } from "./DataTableViewOptions";

export interface DataTableFilterOption {
  columnId: string;
  title: string;
  options: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
}

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  /**
   * Enable global filtering (search across all columns)
   */
  enableGlobalFilter?: boolean;
  /**
   * Enable CSV export
   */
  enableExport?: boolean;
  /**
   * Faceted filters for specific columns
   */
  filters?: DataTableFilterOption[];
}

export function DataTableToolbar<TData>({
  table,
  enableGlobalFilter = true,
  enableExport = true,
  filters = [],
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;
  const globalFilter = table.getState().globalFilter as string;

  const handleExport = () => {
    // Get visible columns only (excluding actions/select)
    const columns = table
      .getAllColumns()
      .filter((col) => col.getIsVisible() && col.id !== "actions" && col.id !== "select")
      .map((col) => ({
        id: col.id,
        header: typeof col.columnDef.header === "string" ? col.columnDef.header : col.id,
        accessor: col.accessorFn,
      }));

    // Get all rows (respecting current filters/sorting)
    const rows = table.getPrePaginationRowModel().rows.map((row) => {
      const rowData: Record<string, string | number | boolean | null> = {};
      columns.forEach((col) => {
        // Use the cell value if possible
        const cellValue = row.getValue(col.id);
        rowData[col.header] = cellValue as string | number | boolean | null;
      });
      return rowData;
    });

    // Generate CSV
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `export-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.append(link);
    link.click();
    link.remove();
  };

  return (
    <div className="flex flex-col items-start justify-between gap-4 py-4 sm:flex-row sm:items-center">
      <div className="flex w-full flex-1 flex-col items-start space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
        {enableGlobalFilter && (
          <Input
            placeholder="Filtrar..."
            value={globalFilter ?? ""}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
            className="h-9 w-full sm:w-62.5 lg:w-87.5"
          />
        )}
        {filters.map((filter) => {
          const column = table.getColumn(filter.columnId);
          return (
            column && (
              <DataTableFacetedFilter
                key={filter.columnId}
                column={column}
                title={filter.title}
                options={filter.options}
              />
            )
          );
        })}
        {isFiltered && (
          <Button variant="ghost" onClick={() => table.resetColumnFilters()} className="h-8 px-2 lg:px-3">
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
        {enableExport && (
          <Button variant="outline" size="sm" onClick={handleExport} className="h-8">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        )}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
