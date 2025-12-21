import { PermissionKey } from "../lib/authz/permissionMap.js";

type RoleDefinition = {
  name: string;
  description: string;
  permissions: PermissionKey[];
};

export const INITIAL_ROLES: RoleDefinition[] = [
  {
    name: "SystemAdministrator",
    description: "Administrador del sistema con acceso total",
    permissions: ["manage.all"] as PermissionKey[],
  },
];
