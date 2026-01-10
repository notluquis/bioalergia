import {
  Column,
  ColumnDef,
  ColumnPinningState,
  ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  OnChangeFn,
  PaginationState,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { CSSProperties, useState } from "react";

import { DataTablePagination } from "./DataTablePagination";
import { DataTableViewOptions } from "./DataTableViewOptions";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pageCount?: number;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  isLoading?: boolean;
  initialPinning?: ColumnPinningState;
}

const getCommonPinningStyles = <TData,>(column: Column<TData>): CSSProperties => {
  const isPinned = column.getIsPinned();
  // const isLastLeft = isPinned === 'left' && column.getIsLastColumn('left')
  // const isFirstRight = isPinned === 'right' && column.getIsFirstColumn('right')

  return {
    boxShadow:
      isPinned === "left"
        ? "-4px 0 4px -4px gray inset"
        : isPinned === "right"
          ? "4px 0 4px -4px gray inset"
          : undefined,
    left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
    opacity: isPinned ? 0.95 : 1,
    position: isPinned ? "sticky" : "relative",
    width: column.getSize(),
    zIndex: isPinned ? 1 : 0,
    backgroundColor: isPinned ? "var(--color-base-100)" : undefined, // ensure opaque for sticky
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
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(initialPinning);

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
    },
    enableRowSelection: true,
    manualPagination: true,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    enablePinning: true,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: onPaginationChange,
    onExpandedChange: setExpanded,
    onColumnPinningChange: setColumnPinning,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <DataTableViewOptions table={table} />
      </div>
      <div className="border-base-300/50 bg-base-100 relative overflow-hidden rounded-2xl border shadow-sm">
        <div
          className="muted-scrollbar overflow-x-auto"
          style={{
            maxWidth: "100vw", // Prevent growing beyond screen
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
                        {/* Resizer Handler */}

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
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="loading loading-spinner loading-md text-primary"></span>
                      <span className="text-base-content/60 text-sm">Cargando...</span>
                    </div>
                  </td>
                </tr>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <>
                    <tr
                      key={row.id}
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
                  </>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="text-base-content/60 h-24 text-center italic">
                    No hay resultados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
