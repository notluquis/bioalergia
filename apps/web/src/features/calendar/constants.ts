/**
 * Calendar module shared constants
 * These values are used for handling null/undefined filter values
 */

/** Value used for null event types in filter dropdowns */
export const NULL_EVENT_TYPE_VALUE = "__NULL__";

/** Value used for null categories in filter dropdowns */
export const NULL_CATEGORY_VALUE = "__NULL_CATEGORY__";

/** Category labels for display */
export const CATEGORY_LABELS = {
  subcutaneous: "Tratamiento subcutáneo",
  test: "Test y exámenes",
  injection: "Inyección",
  maintenance: "Mantención",
} as const;

/** Default filter date range in days */
export const DEFAULT_FILTER_RANGE_DAYS = 14;
