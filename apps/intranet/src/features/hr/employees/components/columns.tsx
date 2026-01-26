import { Chip } from "@heroui/react";
import { getRetentionRateForYear } from "@shared/retention";
import type { ColumnDef } from "@tanstack/react-table";

import Button from "@/components/ui/Button";
import type { Employee } from "@/features/hr/employees/types";

export interface EmployeeTableMeta {
  canEdit: boolean;
  onActivate: (id: number) => void;
  onDeactivate: (id: number) => void;
  onEdit: (employee: Employee) => void;
}

// Helper to safely extract retention rate
function getEmployeeRetentionRate(employee: Employee): number {
  // Use 'any' cast if properties are missing in type definition but present in runtime object
  // or if using legacy fields.
  // The logic from EmployeeTable.tsx:
  const emp = employee as unknown as Record<string, unknown>;
  const rate = emp.retentionRate ?? emp.retention_rate;
  return typeof rate === "number" ? rate : getRetentionRateForYear(new Date().getFullYear());
}

export const columns: ColumnDef<Employee>[] = [
  {
    accessorKey: "full_name",
    cell: ({ row }) => (
      <span className="text-foreground font-medium">{row.original.full_name}</span>
    ),
    header: "Nombre",
  },
  {
    accessorKey: "position",
    cell: ({ row }) => <span className="text-foreground">{row.original.position}</span>,
    header: "Cargo",
  },
  {
    accessorKey: "salaryType",
    cell: ({ row }) => {
      const type = row.original.salaryType;
      const label = type === "FIXED" ? "Fijo" : type === "HOURLY" ? "Por Hora" : type;
      return (
        <Chip size="sm" variant="secondary">
          {label}
        </Chip>
      );
    },
    header: "Contrato",
  },
  {
    accessorKey: "department",
    cell: ({ row }) => <span className="text-default-600">{row.original.department ?? "—"}</span>,
    header: "Departamento",
  },
  {
    accessorKey: "startDate",
    cell: ({ row }) => {
      const date = row.original.startDate;
      if (!date) return <span className="text-default-500">—</span>;
      return <span className="text-default-600">{new Date(date).toLocaleDateString("es-CL")}</span>;
    },
    header: "Inicio",
  },
  {
    accessorKey: "person.email",
    cell: ({ row }) => (
      <span className="text-default-500">{row.original.person?.email ?? "—"}</span>
    ),
    header: "Correo",
  },
  {
    accessorKey: "person.rut",
    cell: ({ row }) => <span className="text-foreground">{row.original.person?.rut ?? "—"}</span>,
    header: "RUT",
  },
  {
    cell: ({ row }) => {
      const e = row.original;
      if (!e.bankName) return <span className="text-default-500">—</span>;
      return (
        <span className="text-foreground whitespace-nowrap">
          {e.bankName}
          {e.bankAccountType ? ` · ${e.bankAccountType}` : ""}
          {e.bankAccountNumber ? ` · ${e.bankAccountNumber}` : ""}
        </span>
      );
    },
    header: "Banco / Cuenta",
    id: "bank",
  },
  {
    accessorFn: (row) => getEmployeeRetentionRate(row),
    cell: ({ row }) => {
      const rate = row.getValue<number>("retentionRate") * 100;
      const formatted = (() => {
        if (rate % 1 === 0) return rate.toFixed(1);
        if ((rate * 10) % 1 === 0) return rate.toFixed(1);
        return rate.toFixed(2);
      })();
      const isAuto =
        getEmployeeRetentionRate(row.original) ===
        getRetentionRateForYear(new Date().getFullYear());

      return (
        <div className="flex flex-col">
          <span className="text-foreground">{formatted.replace(".", ",")}%</span>
          <span className="text-default-400 text-xs">
            {isAuto ? "Auto (por año)" : "Personalizada"}
          </span>
        </div>
      );
    },
    header: "Retención",
    id: "retentionRate",
  },
  {
    accessorKey: "status",
    cell: ({ row }) => (
      <Chip
        className="font-medium"
        color={row.original.status === "ACTIVE" ? "success" : "default"}
        size="sm"
        variant="soft"
      >
        {row.original.status === "ACTIVE" ? "Activo" : "Inactivo"}
      </Chip>
    ),
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
    header: "Estado",
  },
  {
    cell: ({ row, table }) => {
      const meta = table.options.meta as EmployeeTableMeta;
      const { canEdit, onActivate, onDeactivate, onEdit } = meta;
      const employee = row.original;

      if (!canEdit) return null;

      return (
        <div className="flex justify-end gap-2 whitespace-nowrap">
          <Button
            onClick={() => {
              onEdit(employee);
            }}
            size="sm"
            variant="primary"
          >
            Editar
          </Button>
          {employee.status === "ACTIVE" ? (
            <Button
              onClick={() => {
                onDeactivate(employee.id);
              }}
              size="sm"
              variant="outline"
            >
              Desactivar
            </Button>
          ) : (
            <Button
              onClick={() => {
                onActivate(employee.id);
              }}
              size="sm"
              variant="success"
            >
              Activar
            </Button>
          )}
        </div>
      );
    },
    header: () => <div className="text-right">Acciones</div>,
    id: "actions",
  },
];
