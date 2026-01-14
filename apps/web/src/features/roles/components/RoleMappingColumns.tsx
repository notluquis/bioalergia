import { ColumnDef } from "@tanstack/react-table";

import type { Role as AvailableRole } from "@/types/roles";

import type { RoleMapping } from "../api";

export type ExtendedRoleMapping = RoleMapping & {
  isNew?: boolean;
  isModified?: boolean;
};

export const getColumns = (
  availableRoles: AvailableRole[],
  onRoleChange: (employeeRole: string, newAppRole: string) => void
): ColumnDef<ExtendedRoleMapping>[] => [
  {
    accessorKey: "employee_role",
    header: "Cargo en Ficha",
    cell: ({ row }) => <span className="font-medium">{row.original.employee_role}</span>,
  },
  {
    accessorKey: "app_role",
    header: "Rol en Aplicación",
    cell: ({ row }) => {
      const mapping = row.original;
      return (
        <select
          className="select select-bordered select-sm w-full max-w-xs"
          value={mapping.app_role}
          onChange={(e) => onRoleChange(mapping.employee_role, e.target.value)}
        >
          {availableRoles.map((role) => (
            <option key={role.id} value={role.name} title={role.description || ""}>
              {role.name}
            </option>
          ))}
        </select>
      );
    },
  },
];
