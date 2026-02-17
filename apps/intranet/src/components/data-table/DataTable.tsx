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
  type Row,
  type RowSelectionState,
  type SortingState,
  type TableMeta,
  type Table as TanStackTable,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import React, { type CSSProperties, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

import { DataTablePagination } from "./DataTablePagination";
import { type DataTableFilterOption, DataTableToolbar } from "./DataTableToolbar";

interface DataTableProps<TData, TValue, TMeta extends TableMeta<TData> = TableMeta<TData>> {
  /**
   * Size columns based on content like spreadsheet auto-fit.
   * When enabled, fixed widths are only applied to pinned or manually resized columns.
   * @default true
   */
  readonly autoFitColumns?: boolean;
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
   * Recommended for large lists. Use with `virtualizationThreshold`.
   * @default true
   */
  readonly enableVirtualization?: boolean;
  /**
   * Estimated row height in pixels for virtualization.
   * @default 48
   */
  readonly estimatedRowHeight?: number;
  /**
   * Max height for the virtualized scroll container.
   * Used when virtualization is active and `scrollMaxHeight` is not provided.
   * @default "70dvh"
   */
  readonly virtualizationMaxHeight?: number | string;
  /**
   * Max height for the scroll container.
   * Applies regardless of virtualization and enables vertical scroll.
   */
  readonly scrollMaxHeight?: number | string;
  /**
   * Faceted filters for specific columns
   */
  readonly filters?: DataTableFilterOption[];
  readonly initialPinning?: ColumnPinningState;
  readonly isLoading?: boolean;
  /**
   * Metadata to pass to table instance (useful for actions)
   */
  readonly meta?: TMeta;
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
  readonly renderSubComponent?: (props: { row: Row<TData> }) => React.ReactNode;
  readonly rowSelection?: RowSelectionState;
  /**
   * Minimum row count to activate virtualization.
   * Keeps small tables simple while enabling virtualization for large datasets.
   * @default 80
   */
  readonly virtualizationThreshold?: number;
}

const getCommonPinningStyles = <TData,>(
  column: Column<TData>,
  columnSizing: Record<string, number>,
  autoFitColumns: boolean,
): CSSProperties => {
  const isPinned = column.getIsPinned();
  const hasManualSizing =
    columnSizing[column.id] !== undefined || column.columnDef.size !== undefined;
  const applyWidth = !autoFitColumns || Boolean(isPinned) || hasManualSizing;

  let boxShadow: string | undefined;
  if (isPinned === "left") {
    boxShadow = "-4px 0 4px -4px gray inset";
  }
  if (isPinned === "right") {
    boxShadow = "4px 0 4px -4px gray inset";
  }

  return {
    backgroundColor: isPinned ? "hsl(var(--heroui-background))" : undefined,
    boxShadow,
    left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    opacity: isPinned ? 0.95 : 1,
    position: isPinned ? "sticky" : "relative",
    right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
    width: applyWidth ? column.getSize() : undefined,
    zIndex: isPinned ? 1 : 0,
  };
};

interface DataTableContentProps<TData, TValue> {
  readonly autoFitColumns: boolean;
  readonly columns: ColumnDef<TData, TValue>[];
  readonly containerVariant: "default" | "plain";
  readonly enableVirtualization: boolean;
  readonly estimatedRowHeight: number;
  readonly isLoading?: boolean;
  readonly noDataMessage: string;
  readonly onRowClick?: (row: TData) => void;
  readonly renderSubComponent?: (props: { row: Row<TData> }) => React.ReactNode;
  readonly table: TanStackTable<TData>;
  readonly scrollMaxHeight?: number | string;
  readonly virtualizationMaxHeight: number | string;
}

function DataTableContent<TData, TValue>({
  autoFitColumns,
  columns,
  containerVariant,
  enableVirtualization,
  estimatedRowHeight,
  isLoading,
  noDataMessage,
  onRowClick,
  renderSubComponent,
  scrollMaxHeight,
  table,
  virtualizationMaxHeight,
}: DataTableContentProps<TData, TValue>) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const columnSizing = table.getState().columnSizing;

  const virtualizer = useVirtualizer({
    count: enableVirtualization ? rows.length : 0,
    estimateSize: () => estimatedRowHeight,
    getScrollElement: () => tableContainerRef.current,
    overscan: 10,
  });

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div
      className={cn(
        "relative overflow-visible",
        containerVariant === "plain"
          ? "border-0 bg-transparent shadow-none"
          : "rounded-2xl border border-default-200/50 bg-background shadow-sm",
      )}
    >
      <div
        className="muted-scrollbar overflow-x-auto overscroll-y-contain overscroll-x-contain"
        ref={tableContainerRef}
        style={{
          maxWidth: "100%",
          ...((scrollMaxHeight ?? enableVirtualization)
            ? {
                maxHeight: scrollMaxHeight ?? virtualizationMaxHeight,
                overflowY: "auto",
              }
            : {}),
        }}
      >
        <table
          className="min-w-full table-fixed caption-bottom text-sm"
          style={{
            minWidth: autoFitColumns ? undefined : table.getTotalSize(),
            tableLayout: autoFitColumns ? "auto" : "fixed",
            width: "100%",
          }}
        >
          <thead className="[&_tr]:border-b-small [&_tr]:border-divider sticky top-0 z-10 bg-default-100 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
              >
                {headerGroup.headers.map((header) => {
                  const isSortable = header.column.getCanSort();
                  const content = (
                    <>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: <ChevronUp className="h-3.5 w-3.5" />,
                        desc: <ChevronDown className="h-3.5 w-3.5" />,
                      }[header.column.getIsSorted() as string] ??
                        (isSortable ? (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-50" />
                        ) : null)}
                    </>
                  );

                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      className="group relative h-10 px-4 text-left align-middle font-semibold text-default-600 text-xs uppercase tracking-wide whitespace-nowrap [&:has([role=checkbox])]:pr-0"
                      style={{ width: header.getSize() }}
                    >
                      <div
                        className={cn(
                          "flex items-center gap-2",
                          isSortable ? "cursor-pointer select-none" : "",
                        )}
                        {...(isSortable
                          ? {
                              role: "button",
                              tabIndex: 0,
                              onClick: header.column.getToggleSortingHandler(),
                              onKeyDown: (e: React.KeyboardEvent) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  header.column.getToggleSortingHandler()?.(e);
                                }
                              },
                            }
                          : {})}
                      >
                        {content}
                      </div>
                      <Button
                        aria-label="Resize column"
                        isIconOnly
                        size="sm"
                        type="button"
                        variant="ghost"
                        className={`absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none select-none bg-default-100 opacity-0 group-hover:opacity-100 ${
                          header.column.getIsResizing() ? "w-1.5 bg-primary opacity-100" : ""
                        }`}
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onClick={(event) => event.stopPropagation()}
                      />
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="[&_tr:last-child]:border-0 relative">
            {enableVirtualization && rows.length > 0 ? (
              <>
                {virtualRows.length > 0 && (virtualRows[0]?.start ?? 0) > 0 && (
                  <tr>
                    <td style={{ height: `${virtualRows[0]?.start ?? 0}px` }} />
                  </tr>
                )}
                {validRows(rows, virtualRows).map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  if (!row) return null;
                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        className={cn(
                          "border-b-small border-divider transition-colors hover:bg-default-100/50 data-[state=selected]:bg-default-100",
                          onRowClick && "cursor-pointer",
                        )}
                        data-state={row.getIsSelected() ? "selected" : undefined}
                        onClick={() => onRowClick?.(row.original)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            className="whitespace-nowrap px-4 py-3 align-middle text-foreground/90 [&:has([role=checkbox])]:pr-0"
                            key={cell.id}
                            style={getCommonPinningStyles(
                              cell.column,
                              columnSizing,
                              autoFitColumns,
                            )}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                      {row.getIsExpanded() && renderSubComponent && (
                        <tr>
                          <td
                            colSpan={row.getVisibleCells().length}
                            className="p-4 align-middle [&:has([role=checkbox])]:pr-0"
                          >
                            {renderSubComponent({ row })}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {virtualRows.length > 0 &&
                  virtualizer.getTotalSize() > (virtualRows[virtualRows.length - 1]?.end ?? 0) && (
                    <tr>
                      <td
                        style={{
                          height: `${
                            virtualizer.getTotalSize() -
                            (virtualRows[virtualRows.length - 1]?.end ?? 0)
                          }px`,
                        }}
                      />
                    </tr>
                  )}
              </>
            ) : isLoading ? (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center align-middle">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Spinner className="text-primary" color="current" size="md" />
                    <span className="text-default-500 text-sm">Cargando...</span>
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="h-24 text-center text-default-500 italic align-middle"
                >
                  {noDataMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <React.Fragment key={row.id}>
                  <tr
                    className={cn(
                      "border-b-small border-divider transition-colors hover:bg-default-100/50 data-[state=selected]:bg-default-100",
                      onRowClick && "cursor-pointer",
                    )}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        className="whitespace-nowrap px-4 py-3 align-middle text-foreground/90 [&:has([role=checkbox])]:pr-0"
                        key={cell.id}
                        style={getCommonPinningStyles(cell.column, columnSizing, autoFitColumns)}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {row.getIsExpanded() && renderSubComponent && (
                    <tr>
                      <td
                        colSpan={row.getVisibleCells().length}
                        className="p-4 align-middle [&:has([role=checkbox])]:pr-0"
                      >
                        {renderSubComponent({ row })}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Helper to filter valid rows for virtualization matching the implementation plan logic
function validRows<TData>(rows: Row<TData>[], virtualRows: VirtualItem[]) {
  return virtualRows.filter((virtualRow) => rows[virtualRow.index]);
}

export function DataTable<TData, TValue, TMeta extends TableMeta<TData> = TableMeta<TData>>({
  autoFitColumns = true,
  columns,
  columnVisibility: controlledColumnVisibility,
  containerVariant = "default",
  data,
  enableExport = true,
  enableGlobalFilter = true,
  enablePageSizeSelector = true,
  enablePagination = true,
  enableToolbar = true,
  enableVirtualization = true,
  estimatedRowHeight = 48,
  scrollMaxHeight,
  virtualizationMaxHeight = "70dvh",
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
  virtualizationThreshold = 80,
}: DataTableProps<TData, TValue, TMeta>) {
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
  const shouldVirtualize = enableVirtualization && data.length >= virtualizationThreshold;

  const table = useReactTable({
    autoResetPageIndex: !manualPagination,
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
    getRowId: (originalRow: TData, index: number) => {
      const row = originalRow as Record<string, unknown>;
      type RowIdValue = number | string | undefined;
      const id =
        (row.id as RowIdValue)?.toString() ??
        (row.employeeId as RowIdValue)?.toString() ??
        (row._id as RowIdValue)?.toString();
      return id && id.length > 0 ? id : `row_${index}`;
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
      <DataTableContent
        autoFitColumns={autoFitColumns}
        columns={columns}
        containerVariant={containerVariant}
        enableVirtualization={shouldVirtualize}
        estimatedRowHeight={estimatedRowHeight}
        isLoading={isLoading}
        noDataMessage={noDataMessage}
        onRowClick={onRowClick}
        renderSubComponent={renderSubComponent}
        scrollMaxHeight={scrollMaxHeight}
        table={table}
        virtualizationMaxHeight={virtualizationMaxHeight}
      />
      {enablePagination && (
        <DataTablePagination
          enablePageSizeSelector={enablePageSizeSelector}
          pageCount={pageCount}
          pageSizeOptions={pageSizeOptions}
          pagination={pagination ?? internalPagination}
          table={table}
        />
      )}
    </div>
  );
}
