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
  timesheetListQuerySchema,
  prepareEmailSchema,
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
export {
  loginSchema,
  mfaVerifySchema,
  monthParamSchema,
  updateClassificationSchema,
  inviteUserSchema,
  setupUserSchema,
} from "./auth.js";

// MercadoPago
export {
  // Constants
  MP_REPORT_COLUMNS,
  // Schemas
  columnSchema,
  frequencySchema,
  sftpInfoSchema,
  createReportSchema,
  reportSchema,
  listReportsResponseSchema,
  mpConfigSchema,
  mpConfigResponseSchema,
  // Types
  type MpReportColumn,
  type MpFrequency,
  type MpConfig,
  type MpConfigResponse,
  type MpReport,
  type CreateReportRequest,
} from "./mercadopago.js";
