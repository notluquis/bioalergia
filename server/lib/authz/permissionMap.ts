// server/lib/authz/permissionMap.ts

import { readonly } from "../readonly.js";

/**
 * Maps a permission key (e.g., 'user.create') to a CASL action and subject.
 * This provides a single source of truth for permission definitions.
 *
 * IMPORTANT: Every subject here MUST have a corresponding page in route-data.ts
 * that declares it as a required permission. No orphan permissions allowed.
 */
export const permissionMap = readonly({
  // Dashboard - mapped to / (home page)
  "dashboard.read": { action: "read", subject: "Dashboard" },

  // User management - mapped to /settings/users
  "user.create": { action: "create", subject: "User" },
  "user.read": { action: "read", subject: "User" },
  "user.update": { action: "update", subject: "User" },
  "user.delete": { action: "delete", subject: "User" },

  // Transactions - mapped to /finanzas/movements and /finanzas/balances
  "transaction.create": { action: "create", subject: "Transaction" },
  "transaction.read": { action: "read", subject: "Transaction" },
  "transaction.update": { action: "update", subject: "Transaction" },
  "transaction.delete": { action: "delete", subject: "Transaction" },

  // Settings - mapped to /settings/security and /settings/backups
  "setting.read": { action: "read", subject: "Setting" },
  "setting.update": { action: "update", subject: "Setting" },

  // Roles - mapped to /settings/roles
  "role.create": { action: "create", subject: "Role" },
  "role.read": { action: "read", subject: "Role" },
  "role.update": { action: "update", subject: "Role" },
  "role.delete": { action: "delete", subject: "Role" },

  // Persons - mapped to /settings/people and /finanzas/participants
  "person.read": { action: "read", subject: "Person" },
  "person.update": { action: "update", subject: "Person" },
  "person.create": { action: "create", subject: "Person" },
  "person.delete": { action: "delete", subject: "Person" },

  // Counterparts - mapped to /finanzas/counterparts
  "counterpart.read": { action: "read", subject: "Counterpart" },
  "counterpart.update": { action: "update", subject: "Counterpart" },
  "counterpart.create": { action: "create", subject: "Counterpart" },
  "counterpart.delete": { action: "delete", subject: "Counterpart" },

  // Loans - mapped to /finanzas/loans
  "loan.read": { action: "read", subject: "Loan" },
  "loan.update": { action: "update", subject: "Loan" },
  "loan.create": { action: "create", subject: "Loan" },
  "loan.delete": { action: "delete", subject: "Loan" },

  // Services - mapped to /services/*
  "service.read": { action: "read", subject: "Service" },
  "service.update": { action: "update", subject: "Service" },
  "service.create": { action: "create", subject: "Service" },
  "service.delete": { action: "delete", subject: "Service" },

  // Inventory - mapped to /operations/inventory and /settings/inventario
  "inventory.read": { action: "read", subject: "InventoryItem" },
  "inventory.update": { action: "update", subject: "InventoryItem" },
  "inventory.create": { action: "create", subject: "InventoryItem" },
  "inventory.delete": { action: "delete", subject: "InventoryItem" },

  // Production Balance - mapped to /finanzas/production-balances
  "production_balance.read": { action: "read", subject: "ProductionBalance" },
  "production_balance.update": { action: "update", subject: "ProductionBalance" },
  "production_balance.create": { action: "create", subject: "ProductionBalance" },
  "production_balance.delete": { action: "delete", subject: "ProductionBalance" },

  // Calendar Events - mapped to /calendar/*
  "calendar.read": { action: "read", subject: "CalendarEvent" },
  "calendar.update": { action: "update", subject: "CalendarEvent" },
  "calendar.create": { action: "create", subject: "CalendarEvent" },
  "calendar.delete": { action: "delete", subject: "CalendarEvent" },

  // Employees - mapped to /hr/employees
  "employee.read": { action: "read", subject: "Employee" },
  "employee.update": { action: "update", subject: "Employee" },
  "employee.create": { action: "create", subject: "Employee" },
  "employee.delete": { action: "delete", subject: "Employee" },

  // Timesheets - mapped to /hr/timesheets and /hr/audit
  "timesheet.read": { action: "read", subject: "Timesheet" },
  "timesheet.update": { action: "update", subject: "Timesheet" },
  "timesheet.create": { action: "create", subject: "Timesheet" },
  "timesheet.delete": { action: "delete", subject: "Timesheet" },

  // Reports - mapped to /hr/reports
  "report.read": { action: "read", subject: "Report" },
  "report.update": { action: "update", subject: "Report" },

  // Supply Requests - mapped to /operations/supplies
  "supply.read": { action: "read", subject: "SupplyRequest" },
  "supply.update": { action: "update", subject: "SupplyRequest" },
  "supply.create": { action: "create", subject: "SupplyRequest" },
  "supply.delete": { action: "delete", subject: "SupplyRequest" },

  // Bulk Data - mapped to /settings/csv-upload
  "bulkdata.create": { action: "create", subject: "BulkData" },
} as const);

export type PermissionKey = keyof typeof permissionMap;
