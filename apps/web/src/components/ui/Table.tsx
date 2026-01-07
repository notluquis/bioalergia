import { ChevronDown, ChevronUp } from "lucide-react";
import React from "react";

import { LOADING_SPINNER_MD } from "@/lib/styles";
import { cn } from "@/lib/utils";

interface TableColumn<T extends string> {
  key: T;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: "left" | "center" | "right";
}

interface TableProps<T extends string> {
  columns?: TableColumn<T>[];
  children: React.ReactNode;
  className?: string;
  responsive?: boolean;
  variant?: "default" | "glass" | "minimal";
  sortState?: {
    column: T | null;
    direction: "asc" | "desc";
  };
  onSort?: (column: T) => void;
}

interface TableHeaderProps<T extends string> {
  columns: TableColumn<T>[];
  sortState?: {
    column: T | null;
    direction: "asc" | "desc";
  };
  onSort?: (column: T) => void;
  visibleColumns?: Set<T>;
}

interface TableBodyProps {
  children: React.ReactNode;
  loading?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
  columnsCount: number;
}

const TABLE_VARIANTS = {
  default: "overflow-hidden rounded-2xl border border-base-300/50 bg-base-100 shadow-sm",
  glass: "overflow-hidden bg-base-100/50 backdrop-blur-sm",
  minimal: "overflow-hidden rounded-lg border border-base-300/50 bg-base-100",
};

function TableHeader<T extends string>({ columns, sortState, onSort, visibleColumns }: TableHeaderProps<T>) {
  const getSortIcon = (column: T) => {
    if (!sortState || sortState.column !== column) return null;
    return sortState.direction === "asc" ? (
      <ChevronUp className="text-primary ml-1 inline h-3 w-3" />
    ) : (
      <ChevronDown className="text-primary ml-1 inline h-3 w-3" />
    );
  };

  return (
    <thead className="bg-base-200/50">
      <tr>
        {columns
          .filter((col) => !visibleColumns || visibleColumns.has(col.key))
          .map((column) => (
            <th
              key={column.key}
              className={cn(
                "text-base-content/70 px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap uppercase",
                column.sortable && onSort && "hover:bg-base-200 hover:text-primary cursor-pointer transition-colors",
                column.align === "center" && "text-center",
                column.align === "right" && "text-right"
              )}
              style={column.width ? { width: column.width } : undefined}
              onClick={column.sortable && onSort ? () => onSort(column.key) : undefined}
            >
              {column.label}
              {column.sortable && getSortIcon(column.key)}
            </th>
          ))}
      </tr>
    </thead>
  );
}

function TableBody({
  children,
  loading,
  loadingMessage = "Cargando...",
  emptyMessage = "No hay datos para mostrar",
  columnsCount,
}: TableBodyProps) {
  return (
    <tbody>
      {loading ? (
        <tr>
          <td colSpan={columnsCount} className="px-4 py-12 text-center">
            <div className="flex flex-col items-center justify-center gap-2">
              <span className={LOADING_SPINNER_MD}></span>
              <span className="text-base-content/60 text-sm">{loadingMessage}</span>
            </div>
          </td>
        </tr>
      ) : React.Children.count(children) === 0 ? (
        <tr>
          <td colSpan={columnsCount} className="text-base-content/60 px-4 py-12 text-center italic">
            {emptyMessage}
          </td>
        </tr>
      ) : (
        children
      )}
    </tbody>
  );
}

export function Table<T extends string>({
  columns,
  children,
  className,
  responsive = true,
  variant = "default",
  sortState,
  onSort,
  ...props
}: TableProps<T>) {
  const containerClasses = cn(TABLE_VARIANTS[variant], className);
  const tableClass = cn("table w-full text-sm", variant === "glass" && "table-zebra");

  const tableContent = (
    <table className={tableClass} {...props}>
      {columns && <TableHeader columns={columns} sortState={sortState} onSort={onSort} />}
      {children}
    </table>
  );

  if (responsive) {
    return (
      <div className={containerClasses}>
        <div className="muted-scrollbar overflow-x-auto">{tableContent}</div>
      </div>
    );
  }

  return <div className={containerClasses}>{tableContent}</div>;
}

Table.Header = TableHeader;
Table.Body = TableBody;

export { TableBody, TableHeader };
export default Table;
