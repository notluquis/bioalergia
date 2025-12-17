import { PermissionKey } from "../lib/authz/permissionMap.js";

type RoleDefinition = {
  name: string;
  description: string;
  permissions: PermissionKey[];
};

export const INITIAL_ROLES: RoleDefinition[] = [
  {
    name: "CoordinadorFinanciero",
    description: "Ver todo y editar todo",
    permissions: ["manage.all"] as PermissionKey[],
  },
  {
    name: "Socia",
    description: "Solo viewer de todo",
    permissions: ["read.all"] as PermissionKey[],
  },
  {
    name: "Socio",
    description: "Solo viewer de todo",
    permissions: ["read.all"] as PermissionKey[],
  },
  {
    name: "EnfermeroUniversitario",
    description: "Viewer y editor de balance diario solamente",
    permissions: [
      "production_balance.read",
      "production_balance.manage",
      "daily_balance.read",
      "daily_balance.manage",
    ] as PermissionKey[],
  },
  {
    name: "Tens",
    description: "Viewer y editor de balance diario solamente",
    permissions: [
      "production_balance.read",
      "production_balance.manage",
      "daily_balance.read",
      "daily_balance.manage",
    ] as PermissionKey[],
  },
];
