// server/lib/authz/permissionMap.ts

import { readonly } from "../readonly.js";

/**
 * Maps a permission key (e.g., 'user.create') to a CASL action and subject.
 * This provides a single source of truth for permission definitions.
 */
export const permissionMap = readonly({
  "user.create": { action: "create", subject: "User" },
  "user.read": { action: "read", subject: "User" },
  "user.update": { action: "update", subject: "User" },
  "user.delete": { action: "delete", subject: "User" },

  "transaction.create": { action: "create", subject: "Transaction" },
  "transaction.read": { action: "read", subject: "Transaction" },
  "transaction.update": { action: "update", subject: "Transaction" },
  "transaction.delete": { action: "delete", subject: "Transaction" },

  "setting.manage": { action: "manage", subject: "Setting" },
  "manage.all": { action: "manage", subject: "all" },

  "role.create": { action: "create", subject: "Role" },
  "role.read": { action: "read", subject: "Role" },
  "role.update": { action: "update", subject: "Role" },
  "role.delete": { action: "delete", subject: "Role" },

  "permission.read": { action: "read", subject: "Permission" },
  "permission.manage": { action: "manage", subject: "Permission" },

  "person.read": { action: "read", subject: "Person" },
  "person.manage": { action: "manage", subject: "Person" },

  "counterpart.read": { action: "read", subject: "Counterpart" },
  "counterpart.manage": { action: "manage", subject: "Counterpart" },

  "loan.read": { action: "read", subject: "Loan" },
  "loan.manage": { action: "manage", subject: "Loan" },

  "service.read": { action: "read", subject: "Service" },
  "service.manage": { action: "manage", subject: "Service" },

  "inventory.read": { action: "read", subject: "InventoryItem" },
  "inventory.manage": { action: "manage", subject: "InventoryItem" },

  "production_balance.read": { action: "read", subject: "ProductionBalance" },
  "production_balance.manage": { action: "manage", subject: "ProductionBalance" },

  "calendar.read": { action: "read", subject: "CalendarEvent" },
  "calendar.manage": { action: "manage", subject: "CalendarEvent" },

  "employee.read": { action: "read", subject: "Employee" },
  "employee.manage": { action: "manage", subject: "Employee" },

  "timesheet.read": { action: "read", subject: "Timesheet" },
  "timesheet.manage": { action: "manage", subject: "Timesheet" },

  "report.read": { action: "read", subject: "Report" },
  "report.manage": { action: "manage", subject: "Report" },

  "supply.read": { action: "read", subject: "SupplyRequest" },
  "supply.manage": { action: "manage", subject: "SupplyRequest" },
} as const);

export type PermissionKey = keyof typeof permissionMap;
