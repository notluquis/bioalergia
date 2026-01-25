import { Spinner } from "@heroui/react";
import {
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnPinningState,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type OnChangeFn,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import React, { type CSSProperties, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { DataTablePagination } from "./DataTablePagination";
import { type DataTableFilterOption, DataTableToolbar } from "./DataTableToolbar";

interface DataTableProps<TData, TValue> {
  readonly columns: ColumnDef<TData, TValue>[];
  readonly columnVisibility?: VisibilityState;
  readonly data: TData[];
  /**
   * Controls the DataTable container styling when wrapped by cards/surfaces.
   * @default "default"
   */
  readonly containerVariant?: "default" | "plain";
  /**
   * Show pagination controls below the table.
   * @default true
   */
  readonly enablePagination?: boolean;
  /**
   * Show page size selector in pagination controls.
   * @default true
   */
  readonly enablePageSizeSelector?: boolean;
  /**
   * Enable toolbars (search, export, view options)
   * @default true
   */
  readonly enableToolbar?: boolean;
  /**
   * Enable CSV export in toolbar
   * @default true
   */
  readonly enableExport?: boolean;
  /**
   * Enable global filtering (search input) in toolbar
   * @default true
   */
  readonly enableGlobalFilter?: boolean;
  /**
   * Enable row virtualization for large datasets.
   * Recommended for lists > 100 rows.
   */
  readonly enableVirtualization?: boolean;
  /**
   * Estimated row height in pixels for virtualization.
   * @default 48
   */
  readonly estimatedRowHeight?: number;
  /**
   * Faceted filters for specific columns
   */
  readonly filters?: DataTableFilterOption[];
  readonly initialPinning?: ColumnPinningState;
  readonly isLoading?: boolean;
  /**
   * Metadata to pass to table instance (useful for actions)
   */
  readonly meta?: Record<string, unknown>;
  /**
   * Custom message when no data is available
   */
  readonly noDataMessage?: string;
  readonly onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
  readonly onPaginationChange?: OnChangeFn<PaginationState>;
  /**
   * Optional handler for row clicks
   */
  readonly onRowClick?: (row: TData) => void;
  readonly onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  readonly pageCount?: number;
  /**
   * Page size options shown in pagination selector.
   */
  readonly pageSizeOptions?: number[];
  readonly pagination?: PaginationState;
  /**
   * Optional component to render when row is expanded
   */
  readonly renderSubComponent?: (props: {
    row: import("@tanstack/react-table").Row<TData>;
  }) => React.ReactNode;
  readonly rowSelection?: RowSelectionState;
}

const getCommonPinningStyles = <TData,>(column: Column<TData>): CSSProperties => {
  const isPinned = column.getIsPinned();

  let boxShadow: string | undefined;
  if (isPinned === "left") boxShadow = "-4px 0 4px -4px gray inset";
  if (isPinned === "right") boxShadow = "4px 0 4px -4px gray inset";

  return {
    backgroundColor: isPinned ? "hsl(var(--heroui-background))" : undefined,
    boxShadow,
    left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    opacity: isPinned ? 0.95 : 1,
    position: isPinned ? "sticky" : "relative",
    right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
    width: column.getSize(),
    zIndex: isPinned ? 1 : 0,
  };
};

export function DataTable<TData, TValue>({
  columns,
  columnVisibility: controlledColumnVisibility,
  containerVariant = "default",
  data,
  enableExport = true,
  enableGlobalFilter = true,
  enablePageSizeSelector = true,
  enablePagination = true,
  enableToolbar = true,
  enableVirtualization = false,
  estimatedRowHeight = 48,
  filters = [],
  initialPinning = {},
  isLoading,
  meta,
  noDataMessage = "No hay resultados.",
  onColumnVisibilityChange: controlledOnColumnVisibilityChange,
  onPaginationChange,
  onRowClick,
  onRowSelectionChange: controlledOnRowSelectionChange,
  pageCount,
  pageSizeOptions,
  pagination,
  renderSubComponent,
  rowSelection: controlledRowSelection,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [internalColumnVisibility, setInternalColumnVisibility] = useState<VisibilityState>({});
  const [internalRowSelection, setInternalRowSelection] = useState({});
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const rowSelection = controlledRowSelection ?? internalRowSelection;
  const onRowSelectionChange = controlledOnRowSelectionChange ?? setInternalRowSelection;
  const columnVisibility = controlledColumnVisibility ?? internalColumnVisibility;
  const onColumnVisibilityChange =
    controlledOnColumnVisibilityChange ?? setInternalColumnVisibility;

  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(initialPinning);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const [internalPagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const manualPagination = pageCount !== undefined;
  const shouldPaginate = enablePagination && !manualPagination;

  const table = useReactTable({
    columnResizeMode: "onChange",
    columns,
    data,
    enableColumnResizing: true,
    enableGlobalFilter,
    enablePinning: true,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: shouldPaginate ? getPaginationRowModel() : undefined,
    getSortedRowModel: getSortedRowModel(),
    getRowId: (originalRow: TData) => {
      const row = originalRow as Record<string, unknown>;
      type RowIdValue = number | string | undefined;
      return (
        (row.id as RowIdValue)?.toString() ??
        (row.employeeId as RowIdValue)?.toString() ??
        (row._id as RowIdValue)?.toString() ??
        ""
      );
    },
    manualPagination,
    meta,
    onColumnFiltersChange: setColumnFilters,
    onColumnPinningChange: setColumnPinning,
    onColumnVisibilityChange: onColumnVisibilityChange,
    onExpandedChange: setExpanded,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: onPaginationChange ?? setPagination,
    onRowSelectionChange,
    onSortingChange: setSorting,
    pageCount,
    state: {
      columnFilters,
      columnPinning,
      columnVisibility,
      expanded,
      globalFilter,
      pagination: pagination ?? internalPagination,
      rowSelection,
      sorting,
    },
  });

  // Virtual scrolling container ref
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;

  // Row virtualizer - only active when enableVirtualization is true
  const virtualizer = useVirtualizer({
    count: enableVirtualization ? rows.length : 0,
    estimateSize: () => estimatedRowHeight,
    getScrollElement: () => tableContainerRef.current,
    overscan: 10,
  });

  const virtualRows = virtualizer.getVirtualItems();

  // Render rows - either virtual or normal
  const renderRows = (): React.JSX.Element => {
    if (isLoading) {
      return (
        <tr>
          <td className="px-4 py-12 text-center" colSpan={columns.length}>
            <div className="flex flex-col items-center justify-center gap-2">
              <Spinner className="text-primary" color="current" size="md" />
              <span className="text-default-500 text-sm">Cargando...</span>
            </div>
          </td>
        </tr>
      );
    }

    if (rows.length === 0) {
      return (
        <tr>
          <td className="text-default-500 h-24 text-center italic" colSpan={columns.length}>
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
            const row = rows[virtualRow.index];
            if (!row) return null;

            return (
              <React.Fragment key={row.id}>
                <tr
                  className="group hover:bg-background/50 border-default-100/50 border-b transition-colors last:border-0"
                  data-index={virtualRow.index}
                  data-state={row.getIsSelected() && "selected"}
                  ref={virtualizer.measureElement}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      className="text-foreground/90 truncate px-4 py-3 align-middle"
                      key={cell.id}
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
              className={cn(
                "group hover:bg-background/50 data-[state=selected]:bg-primary/10 border-default-100/50 border-b transition-colors last:border-0",
                onRowClick && "cursor-pointer",
              )}
              data-state={row.getIsSelected() && "selected"}
              onClick={() => onRowClick?.(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  className="text-foreground/90 truncate px-4 py-3 align-middle"
                  key={cell.id}
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
      {enableToolbar && (
        <DataTableToolbar
          enableExport={enableExport}
          enableGlobalFilter={enableGlobalFilter}
          filters={filters}
          table={table}
        />
      )}
      <div
        className={cn(
          "relative overflow-visible",
          containerVariant === "plain"
            ? "bg-transparent border-0 shadow-none"
            : "border-default-200/50 bg-background rounded-2xl border shadow-sm",
        )}
      >
        <div
          className="muted-scrollbar overflow-x-auto overscroll-x-contain overscroll-y-contain"
          ref={tableContainerRef}
          style={{
            maxWidth: "100%",
            ...(enableVirtualization ? { maxHeight: "70dvh", overflowY: "auto" } : {}),
          }}
        >
          <table
            className="w-full border-collapse text-left text-sm"
            style={{
              minWidth: table.getTotalSize(),
              width: "100%",
            }}
          >
            <thead className="bg-default-100 sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr className="border-default-200/50 border-b" key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <th
                        className="text-default-600 group relative px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap uppercase"
                        colSpan={header.colSpan}
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        style={{
                          ...getCommonPinningStyles(header.column),
                          width: header.getSize(),
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: <ChevronUp className="h-3.5 w-3.5" />,
                            desc: <ChevronDown className="h-3.5 w-3.5" />,
                          }[header.column.getIsSorted() as string] ??
                            (header.column.getCanSort() ? (
                              <ArrowUpDown className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-50" />
                            ) : null)}
                        </div>
                        <button
                          type="button"
                          aria-label="Resize column"
                          className={`bg-default-100 absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none opacity-0 select-none group-hover:opacity-100 ${
                            header.column.getIsResizing() ? "bg-primary w-1.5 opacity-100" : ""
                          }`}
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onClick={(e) => e.stopPropagation()}
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
              <tfoot className="bg-default-50/50 font-medium">
                {table.getFooterGroups().map((footerGroup) => (
                  <tr key={footerGroup.id}>
                    {footerGroup.headers.map((header) => (
                      <td
                        className="text-foreground px-4 py-3 align-middle"
                        key={header.id}
                        style={{
                          ...getCommonPinningStyles(header.column),
                          width: header.getSize(),
                        }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.footer, header.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tfoot>
            )}
          </table>
        </div>
      </div>
      {enablePagination && (
        <DataTablePagination
          enablePageSizeSelector={enablePageSizeSelector}
          pageSizeOptions={pageSizeOptions}
          table={table}
        />
      )}
    </div>
  );
}
