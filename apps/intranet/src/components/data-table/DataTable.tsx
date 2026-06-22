import {
  Checkbox,
  EmptyState,
  Skeleton,
  type SortDescriptor,
  Table,
  TableLayout,
  type Selection,
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

import {
  applyVisibleSelection,
  getStableRowId as getStableRowIdUtil,
  resolveScrollMode,
  rowSelectionToKeys,
  shouldEnableInternalScroll,
  shouldVirtualizeRows,
  sortingStateToDescriptor,
} from "./data-table-utils";
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
  /**
   * Determines whether a given row can be expanded. Required to enable
   * row expansion when rows have no nested `subRows` (TanStack returns
   * `false` from `getCanExpand` otherwise). Pair with `renderSubComponent`.
   */
  readonly getRowCanExpand?: (row: Row<TData>) => boolean;
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
   * Controlled sorting state. When provided (together with `onSortingChange`),
   * the table is sorting-controlled. Pair with `manualSorting` for server-side
   * sorting (the parent maps the SortingState to its query).
   */
  readonly sorting?: SortingState;
  readonly onSortingChange?: OnChangeFn<SortingState>;
  /**
   * Disable client-side sorting (server already sorts). Defaults to false.
   */
  readonly manualSorting?: boolean;
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
  readonly onSelectionChange: (keys: Selection) => void;
  readonly selectionEnabled: boolean;
  readonly renderSubComponent?: (props: { row: Row<TData> }) => ReactNode;
  readonly rows: Row<TData>[];
  readonly selectedKeys: Set<string>;
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
  onSelectionChange,
  selectionEnabled,
  renderSubComponent,
  rows,
  scrollMaxHeight,
  scrollMode,
  selectedKeys,
  sorting,
  table,
  virtualizationMaxHeight,
}: DataTableContentProps<TData>) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const shouldEnableInternalVerticalScroll = shouldEnableInternalScroll({
    enableVirtualization,
    hasPagination: Boolean(table.getState().pagination),
    scrollMaxHeight,
    scrollMode,
  });
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
  const sortDescriptor: SortDescriptor | undefined = sortingStateToDescriptor(sorting);

  if (!activeHeaderGroup) {
    return null;
  }

  const bodyContent = isLoading ? (
    <Table.Body aria-busy="true">
      {["1", "2", "3", "4", "5", "6"].map((rowKey) => (
        <Table.Row id={`skeleton-row-${rowKey}`} key={`skeleton-row-${rowKey}`}>
          {selectionEnabled && (
            <Table.Cell aria-label="Cargando selección" className="pr-0">
              <Skeleton aria-hidden="true" className="size-4 rounded-md" />
            </Table.Cell>
          )}
          {activeHeaderGroup.headers.map((header, headerIndex) => {
            const loadingColumnKey = String(header.column.id ?? header.id ?? "column");
            // First cell receives role=rowheader from React Aria's grid
            // model. axe (`empty-table-header`) flags a rowheader without
            // visible text — give the cell an aria-label so the skeleton
            // placeholder still announces "loading row N" to screen readers
            // (and ticks the WCAG 2.2 AA name-role-value check).
            return (
              <Table.Cell
                aria-label={headerIndex === 0 ? `Cargando fila ${rowKey}` : undefined}
                key={`skeleton-cell-${rowKey}-${loadingColumnKey}`}
              >
                <Skeleton aria-hidden="true" className="h-4 w-full max-w-36 rounded-md" />
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
        <EmptyState className="flex items-center justify-center text-center text-sm text-muted-foreground size-full">
          {noDataMessage}
        </EmptyState>
      )}
    >
      {(item) => {
        if (item.kind === "expanded") {
          return (
            <Table.Row id={item.id}>
              <Table.Cell colSpan={item.visibleCellCount + (selectionEnabled ? 1 : 0)}>
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
            onAction={() => onRowClick?.(item.row.original)}
          >
            {selectionEnabled && (
              <Table.Cell className="pr-0">
                <Checkbox aria-label="Seleccionar fila" slot="selection" variant="secondary">
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                </Checkbox>
              </Table.Cell>
            )}
            {visibleCells.map((cell) => (
              <Table.Cell
                className="select-text"
                key={cell.id}
                onPointerDownCapture={
                  selectionEnabled ? (event) => event.stopPropagation() : undefined
                }
              >
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
        selectedKeys={selectedKeys}
        selectionBehavior="toggle"
        selectionMode={selectionEnabled ? "multiple" : "none"}
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
        onSelectionChange={onSelectionChange}
      >
        <Table.Header className={enableVirtualization ? "size-full" : undefined}>
          {selectionEnabled && (
            <Table.Column className="pr-0" id="__selection__" minWidth={40}>
              <Checkbox aria-label="Seleccionar todo" slot="selection">
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
              </Checkbox>
            </Table.Column>
          )}
          {activeHeaderGroup.headers.map((header) => {
            const headerContent = header.isPlaceholder
              ? null
              : flexRender(header.column.columnDef.header, header.getContext());
            return (
              <Table.Column
                allowsSorting={header.column.getCanSort()}
                className="font-semibold text-default-700 dark:text-default-200"
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
  getRowCanExpand,
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
  sorting: controlledSorting,
  onSortingChange: controlledOnSortingChange,
  manualSorting = false,
  virtualizationThreshold = 80,
}: DataTableProps<TData, TValue, TMeta>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const sorting = controlledSorting ?? internalSorting;
  const onSortingChange = controlledOnSortingChange ?? setInternalSorting;
  const [internalColumnVisibility, setInternalColumnVisibility] = useState<VisibilityState>({});
  const [internalRowSelection, setInternalRowSelection] = useState({});
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const rowSelection = controlledRowSelection ?? internalRowSelection;
  const onRowSelectionChange = controlledOnRowSelectionChange ?? setInternalRowSelection;
  // Solo mostramos la columna de checkboxes cuando el caller controla la
  // selección (pasa onRowSelectionChange). HeroUI v3 NO auto-renderiza los
  // checkboxes con selectionMode; hay que inyectar Checkbox slot="selection".
  const selectionEnabled = controlledOnRowSelectionChange != null;
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
  const shouldVirtualize = shouldVirtualizeRows({
    enableVirtualization,
    hasRenderSubComponent: Boolean(renderSubComponent),
    rowCount: data.length,
    threshold: virtualizationThreshold,
  });
  const effectiveScrollMode = resolveScrollMode(scrollMode, enablePagination);
  const getStableRowId = (originalRow: TData, index: number) =>
    getStableRowIdUtil(originalRow, index);
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
    getRowCanExpand,
    getSortedRowModel: getSortedRowModel(),
    getRowId: getStableRowId,
    manualPagination,
    manualSorting,
    meta,
    onColumnFiltersChange: setColumnFilters,
    onColumnPinningChange: setColumnPinning,
    onColumnVisibilityChange: onColumnVisibilityChange,
    onExpandedChange: setExpanded,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: onPaginationChange ?? setPagination,
    onRowSelectionChange,
    onSortingChange,
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
  // IMPORTANTE: el row model DEBE computarse aquí, en el componente que llama a
  // useReactTable. Si se llama table.getRowModel() dentro del hijo DataTableContent
  // (que recibe `table` por prop), el memo de TanStack queda STALE por el orden de
  // render padre→hijo: getState().pagination ya refleja la página nueva pero
  // getRowModel() devuelve la página anterior → la paginación (y cualquier cambio
  // de estado) no se reflejaba. Reproducido en tanstack-iso.repro.test.tsx.
  const tableRows = table.getRowModel().rows;
  // Total de filas tras filtros, ANTES de paginar. Se computa acá (donde vive
  // useReactTable) y se pasa al footer para derivar el nº de páginas de forma
  // determinística — `table.getPageCount()` puede devolver 1/-1 en algunos
  // estados aunque haya miles de filas, ocultando la paginación.
  const filteredRowCount = manualPagination ? undefined : table.getFilteredRowModel().rows.length;
  const selectedKeys = useMemo(() => rowSelectionToKeys(rowSelection), [rowSelection]);
  const handleSelectionChange = (keys: Selection) => {
    const visibleRowIds = table.getRowModel().rows.map((row) => row.id);
    onRowSelectionChange((prev) => applyVisibleSelection(prev, visibleRowIds, keys));
  };

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
        onSelectionChange={handleSelectionChange}
        selectionEnabled={selectionEnabled}
        onSortingChange={onSortingChange}
        renderSubComponent={renderSubComponent}
        rows={tableRows}
        scrollMaxHeight={scrollMaxHeight}
        scrollMode={effectiveScrollMode}
        selectedKeys={selectedKeys}
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
          totalRows={filteredRowCount}
        />
      )}
    </div>
  );
}
