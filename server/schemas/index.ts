/**
 * Schemas barrel export
 * Re-exports all schemas to maintain backward compatibility with existing imports
 */

// Shared utilities
export { amountSchema, colorRegex, dateRegex, moneySchema } from "./shared.js";

// Settings
export { settingsSchema } from "./settings.js";

// Finance & Transactions
export {
  balancesQuerySchema,
  balanceUpsertSchema,
  counterpartAccountPayloadSchema,
  counterpartAccountUpdateSchema,
  counterpartPayloadSchema,
  loanCreateSchema,
  loanPaymentSchema,
  loanScheduleRegenerateSchema,
  monthlyExpenseLinkSchema,
  monthlyExpenseSchema,
  monthlyExpenseStatsSchema,
  participantLeaderboardQuerySchema,
  productionBalancePayloadSchema,
  productionBalanceQuerySchema,
  statsQuerySchema,
  transactionsQuerySchema,
} from "./finance.js";

// HR (Employees & Timesheets)
export {
  employeeSchema,
  employeeUpdateSchema,
  prepareEmailSchema,
  roleMappingSchema,
  timesheetBulkSchema,
  timesheetListQuerySchema,
  timesheetPayloadSchema,
  timesheetUpdateSchema,
} from "./hr.js";

// Inventory & Supplies
export {
  commonSupplySchema,
  inventoryCategorySchema,
  inventoryItemSchema,
  inventoryItemUpdateSchema,
  inventoryMovementSchema,
  supplyRequestSchema,
  updateSupplyRequestStatusSchema,
} from "./inventory.js";

// Services
export { serviceCreateSchema, servicePaymentSchema, serviceRegenerateSchema } from "./services.js";

// Auth & Calendar
export {
  inviteUserSchema,
  loginSchema,
  mfaVerifySchema,
  monthParamSchema,
  setupUserSchema,
  updateClassificationSchema,
} from "./auth.js";

// MercadoPago
export {
  // Schemas
  columnSchema,
  type CreateReportRequest,
  createReportSchema,
  frequencySchema,
  listReportsResponseSchema,
  // Constants
  MP_REPORT_COLUMNS,
  type MpConfig,
  type MpConfigResponse,
  mpConfigResponseSchema,
  mpConfigSchema,
  type MpFrequency,
  type MpReport,
  // Types
  type MpReportColumn,
  reportSchema,
  sftpInfoSchema,
} from "./mercadopago.js";
