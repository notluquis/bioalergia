import React from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

interface TableColumn<T extends string> {
  key: T;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: "left" | "center" | "right";
}

interface TableProps<T extends string> {
  columns: TableColumn<T>[];
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
  default: "overflow-hidden rounded-2xl border border-slate-200 bg-base-100 shadow-sm",
  glass: "overflow-hidden bg-base-100",
  minimal: "overflow-hidden rounded-lg border border-gray-200 bg-base-100",
};

const HEADER_VARIANTS = {
  default: "bg-slate-50 text-slate-700",
  glass: "bg-base-100/55 text-[var(--brand-primary)] backdrop-blur-md",
  minimal: "bg-gray-50 text-gray-700",
};

function TableHeader<T extends string>({ columns, sortState, onSort, visibleColumns }: TableHeaderProps<T>) {
  const getSortIcon = (column: T) => {
    if (!sortState || sortState.column !== column) return null;
    return sortState.direction === "asc" ? (
      <ChevronUp className="ml-1 h-3 w-3 inline" />
    ) : (
      <ChevronDown className="ml-1 h-3 w-3 inline" />
    );
  };

  return (
    <thead className="bg-inherit">
      <tr>
        {columns
          .filter((col) => !visibleColumns || visibleColumns.has(col.key))
          .map((column) => (
            <th
              key={column.key}
              className={`
                px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap
                ${column.sortable && onSort ? "cursor-pointer hover:bg-black/5" : ""}
                ${column.align === "center" ? "text-center" : ""}
                ${column.align === "right" ? "text-right" : ""}
              `}
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
          <td colSpan={columnsCount} className="px-4 py-8 text-center text-[var(--brand-primary)]">
            {loadingMessage}
          </td>
        </tr>
      ) : React.Children.count(children) === 0 ? (
        <tr>
          <td colSpan={columnsCount} className="px-4 py-8 text-center text-slate-500">
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
  className = "",
  responsive = true,
  variant = "default",
  sortState,
  onSort,
  ...props
}: TableProps<T>) {
  const containerClasses = `${TABLE_VARIANTS[variant]} ${className}`;
  const headerClasses = HEADER_VARIANTS[variant];

  // Use daisyUI table classes where appropriate; keep existing variants for glass/minimal
  const tableClass = `table w-full text-sm ${variant === 'glass' ? 'table-zebra' : ''}`.trim();

  const tableContent = (
    <table className={tableClass} {...props}>
      <TableHeader columns={columns} sortState={sortState} onSort={onSort} />
      {children}
    </table>
  );

  if (responsive) {
    return (
      <div className={containerClasses}>
        <div className="overflow-x-auto muted-scrollbar">{tableContent}</div>
      </div>
    );
  }

  return <div className={containerClasses}>{tableContent}</div>;
}

// Sub-componentes para usar con el Table
Table.Header = TableHeader;
Table.Body = TableBody;

export default Table;
