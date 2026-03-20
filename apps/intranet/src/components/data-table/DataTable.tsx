import {
  EmptyState,
  Skeleton,
  type SortDescriptor,
  Table,
  TableLayout,
  Virtualizer,
} from "@heroui/react";
import {
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
import { type ReactNode, useMemo, useRef, useState } from "react";

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
   * Enable HeroUI/React Aria column resizing primitives.
   * This is an advanced feature and should be opt-in per table.
   * @default false
   */
  readonly enableColumnResizing?: boolean;
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
   * Controls how vertical scrolling is handled inside the table region.
   * - `auto`: enables internal scroll for virtualized tables and non-paginated tables.
   * - `container`: always enables internal scroll.
   * - `page`: disables internal vertical scroll and delegates to page scroll.
   * @default "auto"
   */
  readonly scrollMode?: "auto" | "container" | "page";
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
  readonly renderSubComponent?: (props: { row: Row<TData> }) => ReactNode;
  readonly rowSelection?: RowSelectionState;
  /**
   * Minimum row count to activate virtualization.
   * Keeps small tables simple while enabling virtualization for large datasets.
   * @default 80
   */
  readonly virtualizationThreshold?: number;
}

interface DataTableContentProps<TData> {
  readonly autoFitColumns: boolean;
  readonly containerVariant: "default" | "plain";
  readonly enableColumnResizing: boolean;
  readonly estimatedRowHeight: number;
  readonly enableVirtualization: boolean;
  readonly isLoading?: boolean;
  readonly noDataMessage: string;
  readonly onRowClick?: (row: TData) => void;
  readonly onSortingChange: (sorting: SortingState) => void;
  readonly renderSubComponent?: (props: { row: Row<TData> }) => ReactNode;
  readonly sorting: SortingState;
  readonly table: TanStackTable<TData>;
  readonly scrollMaxHeight?: number | string;
  readonly scrollMode: "auto" | "container" | "page";
  readonly virtualizationMaxHeight: number | string;
}

type BodyItem<TData> =
  | {
      id: string;
      kind: "data";
      row: Row<TData>;
    }
  | {
      id: string;
      kind: "expanded";
      row: Row<TData>;
      visibleCellCount: number;
    };

function DataTableContent<TData>({
  autoFitColumns,
  containerVariant,
  enableColumnResizing,
  estimatedRowHeight,
  enableVirtualization,
  isLoading,
  noDataMessage,
  onRowClick,
  onSortingChange,
  renderSubComponent,
  scrollMaxHeight,
  scrollMode,
  sorting,
  table,
  virtualizationMaxHeight,
}: DataTableContentProps<TData>) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const shouldEnableInternalVerticalScroll =
    scrollMode === "container" ||
    (scrollMode === "auto" &&
      (Boolean(scrollMaxHeight) || enableVirtualization || !table.getState().pagination));
  const resolvedMaxHeight = scrollMaxHeight ?? virtualizationMaxHeight;
  const headerGroups = table.getHeaderGroups();
  const activeHeaderGroup = headerGroups.at(-1);
  const defaultRowHeaderColumnId =
    activeHeaderGroup?.headers.find((header) => !header.isPlaceholder)?.column.id ?? null;
  const hasResizableColumns =
    enableColumnResizing &&
    (activeHeaderGroup?.headers.some((header) => header.column.getCanResize()) ?? false);
  const bodyItems = useMemo<BodyItem<TData>[]>(() => {
    const items: BodyItem<TData>[] = [];
    for (const row of rows) {
      items.push({
        id: row.id,
        kind: "data",
        row,
      });

      if (row.getIsExpanded() && renderSubComponent) {
        items.push({
          id: `${row.id}-expanded`,
          kind: "expanded",
          row,
          visibleCellCount: row.getVisibleCells().length,
        });
      }
    }
    return items;
  }, [renderSubComponent, rows]);
  const collectionIdentity = useMemo(() => bodyItems.map((item) => item.id).join("|"), [bodyItems]);
  const sortDescriptor: SortDescriptor | undefined = sorting[0]
    ? {
        column: sorting[0].id,
        direction: sorting[0].desc ? "descending" : "ascending",
      }
    : undefined;

  if (!activeHeaderGroup) {
    return null;
  }

  const bodyContent = isLoading ? (
    <Table.Body>
      {["1", "2", "3", "4", "5", "6"].map((rowKey) => (
        <Table.Row id={`skeleton-row-${rowKey}`} key={`skeleton-row-${rowKey}`}>
          {activeHeaderGroup.headers.map((header) => {
            const loadingColumnKey = String(header.column.id ?? header.id ?? "column");
            return (
              <Table.Cell key={`skeleton-cell-${rowKey}-${loadingColumnKey}`}>
                <Skeleton className="h-4 w-full max-w-36 rounded-md" />
              </Table.Cell>
            );
          })}
        </Table.Row>
      ))}
    </Table.Body>
  ) : (
    <Table.Body
      items={bodyItems}
      renderEmptyState={() => (
        <EmptyState className="flex h-full w-full items-center justify-center text-center text-sm text-muted-foreground">
          {noDataMessage}
        </EmptyState>
      )}
    >
      {(item) => {
        if (item.kind === "expanded") {
          return (
            <Table.Row id={item.id}>
              <Table.Cell colSpan={item.visibleCellCount}>
                {renderSubComponent?.({ row: item.row })}
              </Table.Cell>
            </Table.Row>
          );
        }

        const visibleCells = item.row.getVisibleCells();

        return (
          <Table.Row
            className={cn(onRowClick && "cursor-pointer")}
            id={item.id}
            onClick={() => onRowClick?.(item.row.original)}
          >
            {visibleCells.map((cell) => (
              <Table.Cell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </Table.Cell>
            ))}
          </Table.Row>
        );
      }}
    </Table.Body>
  );

  const tableContent = (
    <Table.ScrollContainer
      className="muted-scrollbar"
      ref={tableContainerRef}
      style={
        shouldEnableInternalVerticalScroll
          ? {
              maxHeight: resolvedMaxHeight,
              overflowY: "auto",
            }
          : undefined
      }
    >
      <Table.Content
        aria-label="Tabla de datos"
        className={cn(
          "w-full",
          autoFitColumns ? "min-w-full" : "min-w-max",
          enableVirtualization && "overflow-auto"
        )}
        sortDescriptor={sortDescriptor}
        style={
          enableVirtualization
            ? {
                maxHeight: resolvedMaxHeight,
                overflowY: "auto",
              }
            : undefined
        }
        onSortChange={(descriptor) => {
          if (!descriptor?.column) {
            onSortingChange([]);
            return;
          }
          onSortingChange([
            {
              desc: descriptor.direction === "descending",
              id: String(descriptor.column),
            },
          ]);
        }}
      >
        <Table.Header className={enableVirtualization ? "h-full w-full" : undefined}>
          {activeHeaderGroup.headers.map((header) => {
            const headerContent = header.isPlaceholder
              ? null
              : flexRender(header.column.columnDef.header, header.getContext());
            return (
              <Table.Column
                allowsSorting={header.column.getCanSort()}
                defaultWidth={autoFitColumns ? undefined : header.getSize()}
                id={header.column.id}
                isRowHeader={
                  header.column.columnDef.meta?.isRowHeader ??
                  header.column.id === defaultRowHeaderColumnId
                }
                key={header.id}
                minWidth={header.getSize()}
              >
                {headerContent}
                {enableColumnResizing && header.column.getCanResize() && <Table.ColumnResizer />}
              </Table.Column>
            );
          })}
        </Table.Header>
        {bodyContent}
      </Table.Content>
    </Table.ScrollContainer>
  );

  const tableNode = (
    <Table
      key={collectionIdentity}
      variant={containerVariant === "plain" ? "primary" : "secondary"}
    >
      {hasResizableColumns ? (
        <Table.ResizableContainer>{tableContent}</Table.ResizableContainer>
      ) : (
        tableContent
      )}
    </Table>
  );

  if (enableVirtualization && !isLoading) {
    return (
      <Virtualizer
        layout={TableLayout}
        layoutOptions={{
          headingHeight: 42,
          rowHeight: estimatedRowHeight,
        }}
      >
        {tableNode}
      </Virtualizer>
    );
  }

  return tableNode;
}

export function DataTable<TData, TValue, TMeta extends TableMeta<TData> = TableMeta<TData>>({
  autoFitColumns = true,
  columns,
  columnVisibility: controlledColumnVisibility,
  containerVariant = "default",
  data,
  enableColumnResizing = false,
  enableExport = true,
  enableGlobalFilter = true,
  enablePageSizeSelector = true,
  enablePagination = true,
  enableToolbar = true,
  enableVirtualization = true,
  estimatedRowHeight = 48,
  scrollMaxHeight,
  scrollMode = "auto",
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
  const shouldVirtualize =
    enableVirtualization && data.length >= virtualizationThreshold && !renderSubComponent;
  const effectiveScrollMode = scrollMode === "auto" && !enablePagination ? "container" : scrollMode;
  const getStableRowId = (originalRow: TData, index: number) => {
    const row = originalRow as Record<string, unknown>;
    type RowIdValue = number | string | undefined;
    const id =
      (row.id as RowIdValue)?.toString() ??
      (row.employeeId as RowIdValue)?.toString() ??
      (row._id as RowIdValue)?.toString();
    return id && id.length > 0 ? id : `row_${index}`;
  };
  const dataIdentity = data.map((row, index) => getStableRowId(row, index)).join("|");

  const table = useReactTable({
    autoResetPageIndex: !manualPagination,
    columnResizeMode: "onChange",
    columns,
    data,
    enableColumnResizing,
    enableGlobalFilter,
    enablePinning: true,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: shouldPaginate ? getPaginationRowModel() : undefined,
    getSortedRowModel: getSortedRowModel(),
    getRowId: getStableRowId,
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
    <div className="space-y-1">
      {enableToolbar && (
        <DataTableToolbar
          enableExport={enableExport}
          enableGlobalFilter={enableGlobalFilter}
          filters={filters}
          table={table}
        />
      )}
      <DataTableContent
        key={dataIdentity}
        autoFitColumns={autoFitColumns}
        containerVariant={containerVariant}
        enableColumnResizing={enableColumnResizing}
        estimatedRowHeight={estimatedRowHeight}
        enableVirtualization={shouldVirtualize}
        isLoading={isLoading}
        noDataMessage={noDataMessage}
        onRowClick={onRowClick}
        onSortingChange={setSorting}
        renderSubComponent={renderSubComponent}
        scrollMaxHeight={scrollMaxHeight}
        scrollMode={effectiveScrollMode}
        sorting={sorting}
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
