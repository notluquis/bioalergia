/**
 * Finance module shared constants
 * Common constants used across balances, loans, and transactions
 */

/** Default date range in days for financial queries */
export const DEFAULT_DATE_RANGE_DAYS = 30;

/** Currency formatter for Chilean Pesos (CLP) */
export const CLP_FORMATTER = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Direction labels for display */
export const DIRECTION_LABELS = {
  IN: "Ingreso",
  OUT: "Egreso",
  NEUTRO: "Neutro",
} as const;

/** Payment status labels */
export const PAYMENT_STATUS_LABELS = {
  PENDING: "Pendiente",
  PARTIAL: "Parcial",
  PAID: "Pagado",
  OVERDUE: "Atrasado",
  SKIPPED: "Omitido",
} as const;

/** Loan status labels */
export const LOAN_STATUS_LABELS = {
  ACTIVE: "Activo",
  COMPLETED: "Completado",
  DEFAULTED: "En mora",
} as const;

/** Payment frequency labels */
export const FREQUENCY_LABELS = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quincenal",
  MONTHLY: "Mensual",
} as const;
