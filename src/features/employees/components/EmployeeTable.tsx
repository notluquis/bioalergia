import { useMemo } from "react";
import { fmtCLP } from "../../../lib/format";
import { useAuth } from "../../../context/auth-context";
import { useTable } from "../../../hooks";
import type { Employee } from "../types";
import Button from "../../../components/Button";
import Alert from "../../../components/Alert";

type EmployeeColumn =
  | "name"
  | "role"
  | "email"
  | "rut"
  | "bank"
  | "hourlyRate"
  | "overtimeRate"
  | "retentionRate"
  | "status"
  | "actions";

interface EmployeeTableProps {
  employees: Employee[];
  loading: boolean;
  onEdit: (employee: Employee) => void;
  onDeactivate: (id: number) => void;
  onActivate: (id: number) => void;
}

export default function EmployeeTable({ employees, loading, onEdit, onDeactivate, onActivate }: EmployeeTableProps) {
  const { hasRole } = useAuth();
  const canEdit = hasRole("GOD", "ADMIN");

  const columns: EmployeeColumn[] = [
    "name",
    "role",
    "email",
    "rut",
    "bank",
    "hourlyRate",
    "overtimeRate",
    "retentionRate",
    "status",
    ...(canEdit ? ["actions" as const] : []),
  ];

  const table = useTable<EmployeeColumn>({
    columns,
    initialSortColumn: "name",
    initialPageSize: 50,
  });

  const activeEmployees = useMemo(() => employees.filter((employee) => employee.status === "ACTIVE"), [employees]);

  const sortedEmployees = useMemo(() => {
    if (!table.sortState.column) return employees;

    return [...employees].sort((a, b) => {
      const { column, direction } = table.sortState;
      let aValue: string | number;
      let bValue: string | number;

      switch (column) {
        case "name":
          aValue = a.full_name;
          bValue = b.full_name;
          break;
        case "role":
          aValue = a.role;
          bValue = b.role;
          break;
        case "email":
          aValue = a.email || "";
          bValue = b.email || "";
          break;
        case "hourlyRate":
          aValue = a.hourly_rate;
          bValue = b.hourly_rate;
          break;
        case "overtimeRate":
          aValue = a.overtime_rate || 0;
          bValue = b.overtime_rate || 0;
          break;
        case "retentionRate":
          aValue = a.retention_rate;
          bValue = b.retention_rate;
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          return 0;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        const result = aValue.localeCompare(bValue);
        return direction === "desc" ? -result : result;
      }

      if (aValue < bValue) return direction === "desc" ? 1 : -1;
      if (aValue > bValue) return direction === "desc" ? -1 : 1;
      return 0;
    });
  }, [employees, table.sortState]);

  return (
    <div className="space-y-4">
      {/* Column visibility controls */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs font-semibold text-slate-600">Mostrar columnas:</span>
        {columns
          .filter((col) => col !== "actions")
          .map((column) => (
            <label key={column} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={table.isColumnVisible(column)}
                onChange={() => table.toggleColumn(column)}
                className="rounded"
              />
              <span className="text-slate-600">
                {column === "name" && "Nombre"}
                {column === "role" && "Cargo"}
                {column === "email" && "Correo"}
                {column === "hourlyRate" && "Hora base"}
                {column === "overtimeRate" && "Hora extra"}
                {column === "retentionRate" && "Retención"}
                {column === "rut" && "RUT"}
                {column === "bank" && "Banco / Cuenta"}
                {column === "status" && "Estado"}
              </span>
            </label>
          ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--brand-primary)]/15 bg-white shadow-sm">
        <div className="overflow-x-auto muted-scrollbar">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
              <tr>
                {table.isColumnVisible("name") && (
                  <th
                    className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-[var(--brand-primary)]/20 whitespace-nowrap"
                    {...table.getSortProps("name")}
                  >
                    <span className="inline-flex items-center gap-1">Nombre {table.getSortIcon("name")}</span>
                  </th>
                )}
                {table.isColumnVisible("role") && (
                  <th
                    className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-[var(--brand-primary)]/20 whitespace-nowrap"
                    {...table.getSortProps("role")}
                  >
                    <span className="inline-flex items-center gap-1">Cargo {table.getSortIcon("role")}</span>
                  </th>
                )}
                {table.isColumnVisible("email") && (
                  <th
                    className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-[var(--brand-primary)]/20 whitespace-nowrap"
                    {...table.getSortProps("email")}
                  >
                    <span className="inline-flex items-center gap-1">Correo {table.getSortIcon("email")}</span>
                  </th>
                )}
                {table.isColumnVisible("rut") && (
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">RUT</th>
                )}
                {table.isColumnVisible("bank") && (
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Banco / Cuenta</th>
                )}
                {table.isColumnVisible("hourlyRate") && (
                  <th
                    className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-[var(--brand-primary)]/20"
                    {...table.getSortProps("hourlyRate")}
                  >
                    <span className="inline-flex items-center gap-1">Hora base {table.getSortIcon("hourlyRate")}</span>
                  </th>
                )}
                {table.isColumnVisible("overtimeRate") && (
                  <th
                    className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-[var(--brand-primary)]/20"
                    {...table.getSortProps("overtimeRate")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Hora extra {table.getSortIcon("overtimeRate")}
                    </span>
                  </th>
                )}
                {table.isColumnVisible("retentionRate") && (
                  <th
                    className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-[var(--brand-primary)]/20"
                    {...table.getSortProps("retentionRate")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Retención {table.getSortIcon("retentionRate")}
                    </span>
                  </th>
                )}
                {table.isColumnVisible("status") && (
                  <th
                    className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-[var(--brand-primary)]/20"
                    {...table.getSortProps("status")}
                  >
                    <span className="inline-flex items-center gap-1">Estado {table.getSortIcon("status")}</span>
                  </th>
                )}
                {canEdit && table.isColumnVisible("actions") && (
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedEmployees.map((employee) => (
                <tr key={employee.id} className="odd:bg-slate-50/60">
                  {table.isColumnVisible("name") && (
                    <td className="px-4 py-3 font-medium text-slate-700">{employee.full_name}</td>
                  )}
                  {table.isColumnVisible("role") && <td className="px-4 py-3 text-slate-600">{employee.role}</td>}
                  {table.isColumnVisible("email") && (
                    <td className="px-4 py-3 text-slate-500">{employee.email ?? "—"}</td>
                  )}
                  {table.isColumnVisible("rut") && <td className="px-4 py-3 text-slate-600">{employee.rut ?? "—"}</td>}
                  {table.isColumnVisible("bank") && (
                    <td className="px-4 py-3 text-slate-600">
                      {employee.bank_name ? (
                        <span className="whitespace-nowrap">
                          {employee.bank_name}
                          {employee.bank_account_type ? ` · ${employee.bank_account_type}` : ""}
                          {employee.bank_account_number ? ` · ${employee.bank_account_number}` : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  {table.isColumnVisible("hourlyRate") && (
                    <td className="px-4 py-3 text-slate-600">{fmtCLP(employee.hourly_rate)}</td>
                  )}
                  {table.isColumnVisible("overtimeRate") && (
                    <td className="px-4 py-3 text-slate-600">
                      {employee.overtime_rate != null ? fmtCLP(employee.overtime_rate) : "Automático"}
                    </td>
                  )}
                  {table.isColumnVisible("retentionRate") && (
                    <td className="px-4 py-3 text-slate-600">{(employee.retention_rate * 100).toFixed(1)}%</td>
                  )}
                  {table.isColumnVisible("status") && (
                    <td className="px-4 py-3 text-slate-600">{employee.status === "ACTIVE" ? "Activo" : "Inactivo"}</td>
                  )}
                  {canEdit && table.isColumnVisible("actions") && (
                    <td className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                      <Button variant="secondary" onClick={() => onEdit(employee)} className="mr-3">
                        Editar
                      </Button>
                      {employee.status === "ACTIVE" ? (
                        <Button variant="secondary" onClick={() => onDeactivate(employee.id)}>
                          Desactivar
                        </Button>
                      ) : (
                        <Button variant="secondary" onClick={() => onActivate(employee.id)}>
                          Activar
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {!employees.length && !loading && (
                <tr>
                  <td
                    colSpan={table.getVisibleColumns(columns).length}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    No hay registros.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td
                    colSpan={table.getVisibleColumns(columns).length}
                    className="px-4 py-6 text-center text-[var(--brand-primary)]"
                  >
                    Cargando...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!activeEmployees.length && !loading && (
          <Alert variant="error">Registra a tu primer trabajador para habilitar la captura de horas.</Alert>
        )}
      </div>
    </div>
  );
}
