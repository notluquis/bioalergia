import type { ColumnDef } from "@tanstack/react-table";

import type { Role as AvailableRole } from "@/types/roles";

import type { RoleMapping } from "../api";

export type ExtendedRoleMapping = RoleMapping & {
  isModified?: boolean;
  isNew?: boolean;
};

export const getColumns = (
  availableRoles: AvailableRole[],
  onRoleChange: (employeeRole: string, newAppRole: string) => void,
): ColumnDef<ExtendedRoleMapping>[] => [
  {
    accessorKey: "employee_role",
    cell: ({ row }) => <span className="font-medium">{row.original.employee_role}</span>,
    header: "Cargo en Ficha",
  },
  {
    accessorKey: "app_role",
    cell: ({ row }) => {
      const mapping = row.original;
      return (
        <select
          className="select select-bordered select-sm w-full max-w-xs"
          onChange={(e) => {
            onRoleChange(mapping.employee_role, e.target.value);
          }}
          value={mapping.app_role}
        >
          {availableRoles.map((role) => (
            <option key={role.id} title={role.description || ""} value={role.name}>
              {role.name}
            </option>
          ))}
        </select>
      );
    },
    header: "Rol en Aplicación",
  },
];
