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
    permissions: [
      // Dashboard
      "dashboard.read",
      // Users
      "user.create",
      "user.read",
      "user.update",
      "user.delete",
      // Transactions
      "transaction.create",
      "transaction.read",
      "transaction.update",
      "transaction.delete",
      // Settings
      "setting.read",
      "setting.update",
      // Roles & Permissions
      "role.create",
      "role.read",
      "role.update",
      "role.delete",
      // Permissions (for permission management UI)
      "permission.read",
      "permission.update",
      // Person
      "person.read",
      "person.update",
      "person.create",
      "person.delete",
      // Counterpart
      "counterpart.read",
      "counterpart.update",
      "counterpart.create",
      "counterpart.delete",
      // Loan
      "loan.read",
      "loan.update",
      "loan.create",
      "loan.delete",
      // Service
      "service.read",
      "service.update",
      "service.create",
      "service.delete",
      // Inventory
      "inventory.read",
      "inventory.update",
      "inventory.create",
      "inventory.delete",
      // Production Balance
      "production_balance.read",
      "production_balance.update",
      "production_balance.create",
      "production_balance.delete",
      // Calendar
      "calendar.read",
      "calendar.update",
      "calendar.create",
      "calendar.delete",
      // Employee
      "employee.read",
      "employee.update",
      "employee.create",
      "employee.delete",
      // Timesheet
      "timesheet.read",
      "timesheet.update",
      "timesheet.create",
      "timesheet.delete",
      // Report
      "report.read",
      "report.update",
      // Supply
      "supply.read",
      "supply.update",
      "supply.create",
      "supply.delete",
    ],
  },
];
