/**
 * Schemas barrel export
 * Re-exports all schemas to maintain backward compatibility with existing imports
 */

// Shared utilities
export { amountSchema, moneySchema, dateRegex, colorRegex } from "./shared.js";

// Settings
export { settingsSchema } from "./settings.js";

// Finance & Transactions
export {
  transactionsQuerySchema,
  statsQuerySchema,
  participantLeaderboardQuerySchema,
  counterpartPayloadSchema,
  counterpartAccountPayloadSchema,
  counterpartAccountUpdateSchema,
  balancesQuerySchema,
  balanceUpsertSchema,
  productionBalanceQuerySchema,
  productionBalancePayloadSchema,
  loanCreateSchema,
  loanScheduleRegenerateSchema,
  loanPaymentSchema,
  monthlyExpenseSchema,
  monthlyExpenseLinkSchema,
  monthlyExpenseStatsSchema,
} from "./finance.js";

// HR (Employees & Timesheets)
export {
  employeeSchema,
  employeeUpdateSchema,
  timesheetPayloadSchema,
  timesheetUpdateSchema,
  timesheetBulkSchema,
  roleMappingSchema,
} from "./hr.js";

// Inventory & Supplies
export {
  inventoryCategorySchema,
  inventoryItemSchema,
  inventoryItemUpdateSchema,
  inventoryMovementSchema,
  supplyRequestSchema,
  updateSupplyRequestStatusSchema,
  commonSupplySchema,
} from "./inventory.js";

// Services
export { serviceCreateSchema, serviceRegenerateSchema, servicePaymentSchema } from "./services.js";

// Auth & Calendar
export { loginSchema, mfaVerifySchema, monthParamSchema, updateClassificationSchema } from "./auth.js";
