import { useMemo } from "react";

import { useAuth } from "@/context/AuthContext";
import { useTable } from "@/hooks";
import type { Employee } from "../types";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import Checkbox from "@/components/ui/Checkbox";

type EmployeeColumn = "name" | "role" | "email" | "rut" | "bank" | "retentionRate" | "status" | "actions";

interface EmployeeTableProps {
  employees: Employee[];
  loading: boolean;
  onEdit: (employee: Employee) => void;
  onDeactivate: (id: number) => void;
  onActivate: (id: number) => void;
}

export default function EmployeeTable({ employees, loading, onEdit, onDeactivate, onActivate }: EmployeeTableProps) {
  const { can } = useAuth();
  const canEdit = can("update", "Employee");

  const columns: EmployeeColumn[] = [
    "name",
    "role",
    "email",
    "rut",
    "bank",
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
          aValue = a.position;
          bValue = b.position;
          break;
        case "email":
          aValue = a.person?.email || "";
          bValue = b.person?.email || "";
          break;
        case "retentionRate":
          aValue = 0; // Not in schema
          bValue = 0;
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
        <span className="text-base-content text-xs font-semibold">Mostrar columnas:</span>
        {columns
          .filter((col) => col !== "actions")
          .map((column) => (
            <label key={column} className="flex items-center gap-1 text-xs">
              <Checkbox
                checked={table.isColumnVisible(column)}
                onChange={() => table.toggleColumn(column)}
                className="rounded"
              />
              <span className="text-base-content">
                {column === "name" && "Nombre"}
                {column === "role" && "Cargo"}
                {column === "email" && "Correo"}
                {column === "retentionRate" && "Retención"}
                {column === "rut" && "RUT"}
                {column === "bank" && "Banco / Cuenta"}
                {column === "status" && "Estado"}
              </span>
            </label>
          ))}
      </div>

      <div className="border-primary/15 bg-base-100 overflow-hidden rounded-2xl border shadow-sm">
        <div className="muted-scrollbar overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-primary/10 text-primary">
              <tr>
                {table.isColumnVisible("name") && (
                  <th
                    className="hover:bg-primary/20 cursor-pointer px-4 py-3 text-left font-semibold whitespace-nowrap"
                    {...table.getSortProps("name")}
                  >
                    <span className="inline-flex items-center gap-1">Nombre {table.getSortIcon("name")}</span>
                  </th>
                )}
                {table.isColumnVisible("role") && (
                  <th
                    className="hover:bg-primary/20 cursor-pointer px-4 py-3 text-left font-semibold whitespace-nowrap"
                    {...table.getSortProps("role")}
                  >
                    <span className="inline-flex items-center gap-1">Cargo {table.getSortIcon("role")}</span>
                  </th>
                )}
                {table.isColumnVisible("email") && (
                  <th
                    className="hover:bg-primary/20 cursor-pointer px-4 py-3 text-left font-semibold whitespace-nowrap"
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
                {table.isColumnVisible("retentionRate") && (
                  <th
                    className="hover:bg-primary/20 cursor-pointer px-4 py-3 text-left font-semibold"
                    {...table.getSortProps("retentionRate")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Retención {table.getSortIcon("retentionRate")}
                    </span>
                  </th>
                )}
                {table.isColumnVisible("status") && (
                  <th
                    className="hover:bg-primary/20 cursor-pointer px-4 py-3 text-left font-semibold"
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
                <tr key={employee.id} className="odd:bg-base-200/60">
                  {table.isColumnVisible("name") && (
                    <td className="text-base-content px-4 py-3 font-medium">{employee.full_name}</td>
                  )}
                  {table.isColumnVisible("role") && (
                    <td className="text-base-content px-4 py-3">{employee.position}</td>
                  )}
                  {table.isColumnVisible("email") && (
                    <td className="text-base-content/60 px-4 py-3">{employee.person?.email ?? "—"}</td>
                  )}
                  {table.isColumnVisible("rut") && (
                    <td className="text-base-content px-4 py-3">{employee.person?.rut ?? "—"}</td>
                  )}
                  {table.isColumnVisible("bank") && (
                    <td className="text-base-content px-4 py-3">
                      {employee.bankName ? (
                        <span className="whitespace-nowrap">
                          {employee.bankName}
                          {employee.bankAccountType ? ` · ${employee.bankAccountType}` : ""}
                          {employee.bankAccountNumber ? ` · ${employee.bankAccountNumber}` : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  {table.isColumnVisible("retentionRate") && <td className="text-base-content px-4 py-3">14.5%</td>}
                  {table.isColumnVisible("status") && (
                    <td className="text-base-content px-4 py-3">
                      {employee.status === "ACTIVE" ? "Activo" : "Inactivo"}
                    </td>
                  )}
                  {canEdit && table.isColumnVisible("actions") && (
                    <td className="px-4 py-3">
                      <div className="flex flex-row items-center justify-end gap-2 whitespace-nowrap">
                        <Button variant="primary" size="sm" onClick={() => onEdit(employee)}>
                          Editar
                        </Button>
                        {employee.status === "ACTIVE" ? (
                          <Button variant="outline" size="sm" onClick={() => onDeactivate(employee.id)}>
                            Desactivar
                          </Button>
                        ) : (
                          <Button variant="success" size="sm" onClick={() => onActivate(employee.id)}>
                            Activar
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!employees.length && !loading && (
                <tr>
                  <td
                    colSpan={table.getVisibleColumns(columns).length}
                    className="text-base-content/60 px-4 py-6 text-center"
                  >
                    No hay registros.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={table.getVisibleColumns(columns).length} className="text-primary px-4 py-6 text-center">
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
