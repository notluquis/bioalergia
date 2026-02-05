import { ListBox, Select } from "@heroui/react";
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
        <Select
          aria-label="Rol en Aplicación"
          className="w-full max-w-xs"
          placeholder="Seleccionar rol..."
          selectedKey={mapping.app_role}
          onSelectionChange={(key) => {
            if (key) {
              onRoleChange(mapping.employee_role, key.toString());
            }
          }}
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {availableRoles.map((role) => (
                <ListBox.Item key={role.name} textValue={role.name}>
                  {role.name}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      );
    },
    header: "Rol en Aplicación",
  },
];
