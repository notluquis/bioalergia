import {
  Column,
  ColumnDef,
  ColumnFiltersState,
  ColumnPinningState,
  ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  OnChangeFn,
  PaginationState,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import React, { CSSProperties, useRef, useState } from "react";

import { DataTablePagination } from "./DataTablePagination";
import { DataTableFilterOption, DataTableToolbar } from "./DataTableToolbar";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pageCount?: number;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  isLoading?: boolean;
  initialPinning?: ColumnPinningState;
  /**
   * Enable row virtualization for large datasets.
   * Recommended for lists > 100 rows.
   */
  enableVirtualization?: boolean;
  /**
   * Estimated row height in pixels for virtualization.
   * @default 48
   */
  estimatedRowHeight?: number;
  /**
   * Enable toolbars (search, export, view options)
   * @default true
   */
  enableToolbar?: boolean;
  /**
   * Faceted filters for specific columns
   */
  filters?: DataTableFilterOption[];
}

const getCommonPinningStyles = <TData,>(column: Column<TData>): CSSProperties => {
  const isPinned = column.getIsPinned();

  let boxShadow: string | undefined;
  if (isPinned === "left") boxShadow = "-4px 0 4px -4px gray inset";
  if (isPinned === "right") boxShadow = "4px 0 4px -4px gray inset";

  return {
    boxShadow,
    left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
    opacity: isPinned ? 0.95 : 1,
    position: isPinned ? "sticky" : "relative",
    width: column.getSize(),
    zIndex: isPinned ? 1 : 0,
    backgroundColor: isPinned ? "var(--color-base-100)" : undefined,
  };
};

export function DataTable<TData, TValue>({
  columns,
  data,
  pageCount = -1,
  pagination,
  onPaginationChange,
  isLoading,
  initialPinning = {},
  enableVirtualization = false,
  estimatedRowHeight = 48,
  enableToolbar = true,
  filters = [],
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(initialPinning);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      pagination,
      expanded,
      columnPinning,
      columnFilters,
      globalFilter,
    },
    enableRowSelection: true,
    manualPagination: true,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    enablePinning: true,
    enableGlobalFilter: true,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: onPaginationChange,
    onExpandedChange: setExpanded,
    onColumnPinningChange: setColumnPinning,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // getSortedRowModel: getSortedRowModel(), // Sorting is usually server-side in this app? Check existing code.
    // Existing code didn't have getSortedRowModel, assuming server-side sorting for now since manualPagination is true?
    // But manualPagination usually implies server-side everything.
    // If I add getFilteredRowModel, it only works on client-side data.
    // If pagination is manual, client-side filtering might be weird if it only filters the current page?
    // Wait, if manualPagination is true, then data passed is likely only the current page.
    // In that case, client-side global filtering will ONLY filter the current page data.
    // That is often acceptable for "quick search on current page", but usually global search triggers a backend query.
    // The previous implementation didn't have any filtering.
    // For now, I will enable client-side filtering features as "enhancement" for whatever data is present.
  });

  // Virtual scrolling container ref
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;

  // Row virtualizer - only active when enableVirtualization is true
  const virtualizer = useVirtualizer({
    count: enableVirtualization ? rows.length : 0,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 10,
  });

  const virtualRows = virtualizer.getVirtualItems();

  // Render rows - either virtual or normal
  // eslint-disable-next-line sonarjs/function-return-type -- Render function with multiple valid JSX return paths
  const renderRows = (): React.ReactNode => {
    if (isLoading) {
      return (
        <tr>
          <td colSpan={columns.length} className="px-4 py-12 text-center">
            <div className="flex flex-col items-center justify-center gap-2">
              <span className="loading loading-spinner loading-md text-primary"></span>
              <span className="text-base-content/60 text-sm">Cargando...</span>
            </div>
          </td>
        </tr>
      );
    }

    if (rows.length === 0) {
      return (
        <tr>
          <td colSpan={columns.length} className="text-base-content/60 h-24 text-center italic">
            No hay resultados.
          </td>
        </tr>
      );
    }

    // Virtualized rendering
    if (enableVirtualization && virtualRows.length > 0) {
      // Pre-filter valid virtual rows to avoid null returns
      const validVirtualRows = virtualRows.filter((vr) => rows[vr.index] !== undefined);

      return (
        <>
          {validVirtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index]!;

            return (
              <React.Fragment key={row.id}>
                <tr
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-base-100/50 border-base-200/50 border-b transition-colors last:border-0"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="text-base-content/90 truncate px-4 py-3 align-middle"
                      style={{
                        ...getCommonPinningStyles(cell.column),
                        width: cell.column.getSize(),
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {row.getIsExpanded() && (
                  <tr>
                    <td colSpan={row.getVisibleCells().length}>
                      <div className="bg-base-200/30 p-4">
                        <pre className="custom-scrollbar bg-base-100 max-h-60 overflow-auto rounded border p-2 text-xs">
                          {JSON.stringify(row.original, null, 2)}
                        </pre>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </>
      );
    }

    // Normal (non-virtualized) rendering
    return (
      <>
        {rows.map((row) => (
          <React.Fragment key={row.id}>
            <tr
              data-state={row.getIsSelected() && "selected"}
              className="hover:bg-base-100/50 border-base-200/50 border-b transition-colors last:border-0"
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="text-base-content/90 truncate px-4 py-3 align-middle"
                  style={{
                    ...getCommonPinningStyles(cell.column),
                    width: cell.column.getSize(),
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
            {row.getIsExpanded() && (
              <tr>
                <td colSpan={row.getVisibleCells().length}>
                  <div className="bg-base-200/30 p-4">
                    <pre className="custom-scrollbar bg-base-100 max-h-60 overflow-auto rounded border p-2 text-xs">
                      {JSON.stringify(row.original, null, 2)}
                    </pre>
                  </div>
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
      </>
    );
  };

  return (
    <div className="space-y-4">
      {enableToolbar && <DataTableToolbar table={table} filters={filters} />}
      <div className="border-base-300/50 bg-base-100 relative overflow-hidden rounded-2xl border shadow-sm">
        <div
          ref={tableContainerRef}
          className="muted-scrollbar overflow-x-auto"
          style={{
            maxWidth: "100vw",
            ...(enableVirtualization ? { maxHeight: "70vh", overflowY: "auto" } : {}),
          }}
        >
          <table
            className="table w-full text-sm"
            style={{
              width: table.getTotalSize(),
            }}
          >
            <thead className="bg-base-200/50 sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-base-300/50 border-b">
                  {headerGroup.headers.map((header) => {
                    return (
                      <th
                        key={header.id}
                        colSpan={header.colSpan}
                        className="text-base-content/70 group relative px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap uppercase"
                        style={{
                          ...getCommonPinningStyles(header.column),
                          width: header.getSize(),
                        }}
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        <button
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          aria-label="Resize column"
                          className={`bg-base-300 absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none opacity-0 select-none group-hover:opacity-100 ${
                            header.column.getIsResizing() ? "bg-primary w-1.5 opacity-100" : ""
                          }`}
                        />
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody
              style={
                enableVirtualization
                  ? {
                      height: `${virtualizer.getTotalSize()}px`,
                      position: "relative",
                    }
                  : undefined
              }
            >
              {renderRows()}
            </tbody>
          </table>
        </div>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
