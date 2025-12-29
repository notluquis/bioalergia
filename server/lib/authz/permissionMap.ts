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

  "setting.read": { action: "read", subject: "Setting" },
  "setting.update": { action: "update", subject: "Setting" },

  "role.create": { action: "create", subject: "Role" },
  "role.read": { action: "read", subject: "Role" },
  "role.update": { action: "update", subject: "Role" },
  "role.delete": { action: "delete", subject: "Role" },

  "permission.read": { action: "read", subject: "Permission" },
  "permission.update": { action: "update", subject: "Permission" },

  "person.read": { action: "read", subject: "Person" },
  "person.update": { action: "update", subject: "Person" },
  "person.create": { action: "create", subject: "Person" },
  "person.delete": { action: "delete", subject: "Person" },

  "counterpart.read": { action: "read", subject: "Counterpart" },
  "counterpart.update": { action: "update", subject: "Counterpart" },
  "counterpart.create": { action: "create", subject: "Counterpart" },
  "counterpart.delete": { action: "delete", subject: "Counterpart" },

  "loan.read": { action: "read", subject: "Loan" },
  "loan.update": { action: "update", subject: "Loan" },
  "loan.create": { action: "create", subject: "Loan" },
  "loan.delete": { action: "delete", subject: "Loan" },

  "service.read": { action: "read", subject: "Service" },
  "service.update": { action: "update", subject: "Service" },
  "service.create": { action: "create", subject: "Service" },
  "service.delete": { action: "delete", subject: "Service" },

  "inventory.read": { action: "read", subject: "InventoryItem" },
  "inventory.update": { action: "update", subject: "InventoryItem" },
  "inventory.create": { action: "create", subject: "InventoryItem" },
  "inventory.delete": { action: "delete", subject: "InventoryItem" },

  "production_balance.read": { action: "read", subject: "ProductionBalance" },
  "production_balance.update": { action: "update", subject: "ProductionBalance" },
  "production_balance.create": { action: "create", subject: "ProductionBalance" },
  "production_balance.delete": { action: "delete", subject: "ProductionBalance" },

  "daily_balance.read": { action: "read", subject: "DailyBalance" },
  "daily_balance.update": { action: "update", subject: "DailyBalance" },
  "daily_balance.create": { action: "create", subject: "DailyBalance" },
  "daily_balance.delete": { action: "delete", subject: "DailyBalance" },

  "calendar.read": { action: "read", subject: "CalendarEvent" },
  "calendar.update": { action: "update", subject: "CalendarEvent" },
  "calendar.create": { action: "create", subject: "CalendarEvent" },
  "calendar.delete": { action: "delete", subject: "CalendarEvent" },

  "employee.read": { action: "read", subject: "Employee" },
  "employee.update": { action: "update", subject: "Employee" },
  "employee.create": { action: "create", subject: "Employee" },
  "employee.delete": { action: "delete", subject: "Employee" },

  "timesheet.read": { action: "read", subject: "Timesheet" },
  "timesheet.update": { action: "update", subject: "Timesheet" },
  "timesheet.create": { action: "create", subject: "Timesheet" },
  "timesheet.delete": { action: "delete", subject: "Timesheet" },

  "report.read": { action: "read", subject: "Report" },
  "report.update": { action: "update", subject: "Report" },

  "supply.read": { action: "read", subject: "SupplyRequest" },
  "supply.update": { action: "update", subject: "SupplyRequest" },
  "supply.create": { action: "create", subject: "SupplyRequest" },
  "supply.delete": { action: "delete", subject: "SupplyRequest" },
} as const);

export type PermissionKey = keyof typeof permissionMap;
