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
  RowSelectionState,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import React, { CSSProperties, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { DataTablePagination } from "./DataTablePagination";
import { DataTableFilterOption, DataTableToolbar } from "./DataTableToolbar";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pageCount?: number;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
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
  /**
   * Metadata to pass to table instance (useful for actions)
   */
  meta?: any;
  /**
   * Custom message when no data is available
   */
  noDataMessage?: string;
  /**
   * Optional handler for row clicks
   */
  onRowClick?: (row: TData) => void;
  /**
   * Optional component to render when row is expanded
   */
  renderSubComponent?: (props: { row: import("@tanstack/react-table").Row<TData> }) => React.ReactNode;
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
  pageCount,
  pagination,
  onPaginationChange,
  isLoading,
  initialPinning = {},
  enableVirtualization = false,
  estimatedRowHeight = 48,
  enableToolbar = true,
  filters = [],
  meta,
  noDataMessage = "No hay resultados.",
  onRowClick,
  rowSelection: controlledRowSelection,
  onRowSelectionChange: controlledOnRowSelectionChange,
  columnVisibility: controlledColumnVisibility,
  onColumnVisibilityChange: controlledOnColumnVisibilityChange,
  renderSubComponent,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [internalColumnVisibility, setInternalColumnVisibility] = useState<VisibilityState>({});
  const [internalRowSelection, setInternalRowSelection] = useState({});
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const rowSelection = controlledRowSelection ?? internalRowSelection;
  const onRowSelectionChange = controlledOnRowSelectionChange ?? setInternalRowSelection;
  const columnVisibility = controlledColumnVisibility ?? internalColumnVisibility;
  const onColumnVisibilityChange = controlledOnColumnVisibilityChange ?? setInternalColumnVisibility;

  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(initialPinning);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const [internalPagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      columnPinning,
      globalFilter,
      pagination: pagination ?? internalPagination,
      expanded,
    },
    meta,
    enableRowSelection: true,
    manualPagination: pageCount !== undefined,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    enablePinning: true,
    enableGlobalFilter: true,
    onSortingChange: setSorting,
    onColumnVisibilityChange: onColumnVisibilityChange,
    onRowSelectionChange,
    onPaginationChange: onPaginationChange ?? setPagination,
    onExpandedChange: setExpanded,
    onColumnPinningChange: setColumnPinning,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row: any) => row.id?.toString() ?? row.employeeId?.toString() ?? row._id?.toString(),
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
  const renderRows = (): React.JSX.Element => {
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
            {noDataMessage}
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
                {row.getIsExpanded() && renderSubComponent && (
                  <tr>
                    <td colSpan={row.getVisibleCells().length}>{renderSubComponent({ row })}</td>
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
              onClick={() => onRowClick?.(row.original)}
              className={cn(
                "hover:bg-base-100/50 data-[state=selected]:bg-primary/10 border-base-200/50 border-b transition-colors last:border-0",
                onRowClick && "cursor-pointer"
              )}
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
            {row.getIsExpanded() && renderSubComponent && (
              <tr>
                <td colSpan={row.getVisibleCells().length}>{renderSubComponent({ row })}</td>
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
            maxWidth: "100%",
            ...(enableVirtualization ? { maxHeight: "70vh", overflowY: "auto" } : {}),
          }}
        >
          <table
            className="table w-full text-sm"
            style={{
              width: "100%",
              minWidth: table.getTotalSize(),
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
            {table.getFooterGroups().length > 0 && (
              <tfoot className="bg-base-200/50 font-medium">
                {table.getFooterGroups().map((footerGroup) => (
                  <tr key={footerGroup.id}>
                    {footerGroup.headers.map((header) => (
                      <td
                        key={header.id}
                        className="text-base-content px-4 py-3 align-middle"
                        style={{
                          ...getCommonPinningStyles(header.column),
                          width: header.getSize(),
                        }}
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.footer, header.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tfoot>
            )}
          </table>
        </div>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
