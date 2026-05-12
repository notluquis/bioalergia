/**
 * Finance module shared constants
 * Common constants used across balances, loans, and transactions
 */

/** Default date range in days for financial queries */
export const DEFAULT_DATE_RANGE_DAYS = 30;

/** Currency formatter for Chilean Pesos (CLP) */
export const CLP_FORMATTER = new Intl.NumberFormat("es-CL", {
  currency: "CLP",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  style: "currency",
});

/** Direction labels for display */
export const DIRECTION_LABELS = {
  IN: "Ingreso",
  NEUTRO: "Neutro",
  OUT: "Egreso",
} as const;

/** Payment status labels */
export const PAYMENT_STATUS_LABELS = {
  OVERDUE: "Atrasado",
  PAID: "Pagado",
  PARTIAL: "Parcial",
  PENDING: "Pendiente",
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
  BIWEEKLY: "Quincenal",
  MONTHLY: "Mensual",
  WEEKLY: "Semanal",
} as const;
