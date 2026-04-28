/**
 * DTE Analytics - Strict Type Definitions
 * Following Zenstack v3, TanStack v3, and Zod validation patterns
 */

/**
 * Brand type for validated YYYY-MM formatted period strings
 * At compile time, same as string; validation happens at runtime via Zod
 */
export type ValidatedPeriod = string;

/**
 * Raw API response data from aggregated DTE queries
 * Direct mapping from backend DTEPeriod aggregations
 */
export interface DTESummaryRaw {
  period: string; // Raw format YYYY-MM from API transformation
  count: number; // Document count for the period
  totalAmount: number; // Total amount in CLP
  exemptAmount: number; // Exempt (non-taxable) amount
  netAmount: number; // Net (taxable) amount
  taxAmount: number; // IVA (tax) amount
  averageAmount: number; // Average per document
}

export interface DTEListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface DTESalesDetail {
  id: string;
  documentType: number;
  saleType: string;
  clientRUT: string;
  clientName: string;
  folio: string;
  documentDate: string;
  exemptAmount: number;
  netAmount: number;
  ivaAmount: number;
  totalAmount: number;
  emitterRUT: null | string;
  referenceDocType: null | string;
  referenceDocFolio: null | string;
  lineItemsCount: number;
  linkedEventsCount: number;
}

export interface DTESalesLinkedEvent {
  amountExpected: null | number;
  amountPaid: null | number;
  calendarId: string;
  confidenceScore: null | number;
  displayName: null | string;
  eventDate: string;
  eventId: string;
  eventTime: null | string;
  matchedBy: null | string;
  seriesKind: "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT" | null;
  summary: null | string;
}

export interface DTESalesLinkedEventsResponse {
  dte: DTESalesDetail;
  linkedEvents: DTESalesLinkedEvent[];
}

export interface DTEPurchaseDetail {
  id: string;
  documentType: number;
  purchaseType: string;
  providerRUT: string;
  providerName: string;
  folio: string;
  documentDate: string;
  receiptDate: string;
  exemptAmount: number;
  netAmount: number;
  recoverableIVA: number;
  nonRecoverableIVA: number;
  lineItemsCount: number;
  totalAmount: number;
}

export interface DTELineItem {
  id: string;
  lineNumber: number;
  itemName: string;
  itemDescription: null | string;
  quantity: number;
  unit: null | string;
  unitPrice: number;
  amount: number;
  isExempt: boolean;
  itemCode: null | string;
  itemCodeType: null | string;
  discountPercent: null | number;
  discountAmount: null | number;
}

export interface DTEFetchXmlResultDetail {
  folio: string;
  documentType: number;
  lineItemsCount: number;
  status: "already_has" | "error" | "fetched" | "not_found";
}

/**
 * Validated DTE Summary after Zod parsing
 * Guarantees all numeric values are valid numbers
 */
export interface DTESummary extends DTESummaryRaw {
  period: ValidatedPeriod;
}

/**
 * Parsed period components with validation guarantees
 * Always contains valid YYYY and MM values
 */
export interface ParsedPeriod {
  readonly year: string; // YYYY format, validated
  readonly month: string; // MM format (01-12), validated
  readonly period: ValidatedPeriod;
}

/**
 * Monthly summary data for single-year charts (BarChart)
 * Each object represents one month with aggregated metrics
 */
export interface MonthlyChartData {
  readonly month: string; // Abbreviated month name (Ene, Feb, etc.)
  readonly totalAmount: number;
  readonly exemptAmount: number;
  readonly netAmount: number;
  readonly taxAmount: number;
  readonly averageAmount: number;
  readonly count: number;
}

/**
 * Summary totals across all months in a year
 * Used for KPI cards display
 */
export interface YearlyTotals {
  readonly totalAmount: number;
  readonly exemptAmount: number;
  readonly netAmount: number;
  readonly taxAmount: number;
  readonly averageAmount: number;
  readonly count: number;
}

/**
 * Intermediate data structure for comparison charts (LineChart)
 * Groups DTE data by month across multiple years
 */
export interface MonthYearData extends DTESummary {
  readonly year: string; // Extracted from period
}

/**
 * Comparison chart data point with dynamic year columns
 * Month as key, each year as numeric value
 * Example: { month: "Ene", "2024": 1000000, "2025": 1500000 }
 */
export type ComparisonChartData = {
  readonly month: string;
} & Record<string, number | string>; // Year string keys with numeric values

/**
 * Props for monthly summary components with strict typing
 */
export interface MonthlySummaryProps {
  readonly selectedYear: string;
  readonly setSelectedYear: (year: string) => void;
  readonly yearOptions: readonly string[];
}

/**
 * Color palette for multi-series visualizations
 * Ensures consistent branding across all charts
 */
export const CHART_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Green
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Purple
] as const;

export type ChartColorHex = (typeof CHART_COLORS)[number];

export const CHART_THEME = {
  axis: "#94a3b8",
  grid: "#334155",
  legend: "#cbd5e1",
  tooltipBackground: "rgba(15, 23, 42, 0.94)",
  tooltipBorder: "#334155",
  tooltipLabel: "#f8fafc",
  tooltipValue: "#e2e8f0",
} as const;

// Regex patterns defined at top level for performance
const PERIOD_FORMAT_REGEX = /^\d{4}-\d{2}$/;

/**
 * Type guard to ensure string is ValidatedPeriod
 */
export function isValidatedPeriod(value: string): value is ValidatedPeriod {
  return PERIOD_FORMAT_REGEX.test(value);
}

/**
 * Type narrowing function for DTE summary arrays
 */
export function assertDTESummaryArray(data: unknown[]): asserts data is DTESummary[] {
  if (!Array.isArray(data)) {
    throw new TypeError("Expected array of DTESummary");
  }
}
