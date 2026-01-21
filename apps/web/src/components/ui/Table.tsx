import { Spinner } from "@heroui/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";

interface TableBodyProps {
  children: React.ReactNode;
  columnsCount: number;
  emptyMessage?: string;
  loading?: boolean;
  loadingMessage?: string;
}

export interface TableColumn<T extends string> {
  align?: "center" | "left" | "right";
  key: T;
  label: string;
  sortable?: boolean;
  width?: string;
}

export interface TableHeaderProps<T extends string> {
  columns: TableColumn<T>[];
  onSort?: (column: T) => void;
  sortState?: {
    column: null | T;
    direction: "asc" | "desc";
  };
  visibleColumns?: Set<T>;
}

export interface TableProps<T extends string> {
  children: React.ReactNode;
  className?: string;
  columns?: TableColumn<T>[];
  onSort?: (column: T) => void;
  responsive?: boolean;
  sortState?: {
    column: null | T;
    direction: "asc" | "desc";
  };
  variant?: "default" | "glass" | "minimal";
}

const TABLE_VARIANTS = {
  default: "overflow-hidden rounded-2xl border border-base-300/50 bg-base-100 shadow-sm",
  glass: "overflow-hidden bg-base-100/50 backdrop-blur-sm",
  minimal: "overflow-hidden rounded-lg border border-base-300/50 bg-base-100",
};

export function Table<T extends string>({
  children,
  className,
  columns,
  onSort,
  responsive = true,
  sortState,
  variant = "default",
  ...props
}: Readonly<TableProps<T>>) {
  // eslint-disable-next-line security/detect-object-injection
  const containerClasses = cn(TABLE_VARIANTS[variant], className);
  const tableClass = cn(
    "w-full text-sm text-left caption-bottom",
    variant === "glass" && "[&_tbody_tr:nth-child(even)]:bg-default-100/50",
  );

  const tableContent = (
    <table className={tableClass} {...props}>
      {columns && <TableHeader columns={columns} onSort={onSort} sortState={sortState} />}
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

function TableBody({
  children,
  columnsCount,
  emptyMessage = "No hay datos para mostrar",
  loading,
  loadingMessage = "Cargando...",
}: Readonly<TableBodyProps>): React.JSX.Element {
  const content = (() => {
    if (loading) {
      return (
        <tr>
          <td className="px-4 py-12 text-center" colSpan={columnsCount}>
            <div className="flex flex-col items-center justify-center gap-2">
              <Spinner size="md" />
              <span className="text-base-content/60 text-sm">{loadingMessage}</span>
            </div>
          </td>
        </tr>
      );
    }
    if (React.Children.count(children) === 0) {
      return (
        <tr>
          <td className="text-base-content/60 px-4 py-12 text-center italic" colSpan={columnsCount}>
            {emptyMessage}
          </td>
        </tr>
      );
    }
    return <>{children}</>;
  })();

  return <tbody>{content}</tbody>;
}

function TableHeader<T extends string>({
  columns,
  onSort,
  sortState,
  visibleColumns,
}: Readonly<TableHeaderProps<T>>) {
  const getSortIcon = (column: T) => {
    if (sortState?.column !== column) return null;
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
              className={cn(
                "text-base-content/70 px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap uppercase",
                column.sortable &&
                  onSort &&
                  "hover:bg-base-200 hover:text-primary cursor-pointer transition-colors",
                column.align === "center" && "text-center",
                column.align === "right" && "text-right",
              )}
              key={column.key}
              onClick={
                column.sortable && onSort
                  ? () => {
                      onSort(column.key);
                    }
                  : undefined
              }
              style={column.width ? { width: column.width } : undefined}
            >
              {column.label}
              {column.sortable && getSortIcon(column.key)}
            </th>
          ))}
      </tr>
    </thead>
  );
}

Table.Header = TableHeader;
Table.Body = TableBody;

export { TableBody, TableHeader };
export default Table;
