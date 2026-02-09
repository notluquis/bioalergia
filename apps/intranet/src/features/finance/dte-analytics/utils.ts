/**
 * DTE Analytics - Utility Functions
 * Data transformation and formatting utilities with strict typing
 */

import type { ComparisonChartData, DTESummaryRaw, MonthlyChartData, YearlyTotals } from "./types";
import { safeParsePeriod, validateDTESummaryArray } from "./validators";

/**
 * Month names in Spanish (abbreviated)
 * Used consistently across all charts
 */
export const MONTH_NAMES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

export type MonthName = (typeof MONTH_NAMES)[number];

/**
 * Get month name by index (0-11)
 * Type-safe month retrieval
 */
export function getMonthName(index: number): MonthName {
  if (index < 0 || index > 11) {
    throw new RangeError(`Month index must be between 0-11, got ${index}`);
  }
  const month = MONTH_NAMES[index];
  // Type assertion is safe because we validated the range
  return month as MonthName;
}

/**
 * Format currency value for display in es-CL locale
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    currency: "CLP",
    style: "currency",
  }).format(value);
}

/**
 * Format currency with compact notation (K/M/B) for chart axes
 * Examples: 13495000 → "13.5M", 8500000000 → "8.5B"
 */
export function formatCurrencyCompact(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "N/A";
  }

  const absValue = Math.abs(value);

  if (absValue >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1).replace(".", ",")}B`;
  }
  if (absValue >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  }
  if (absValue >= 1_000) {
    return `$${(value / 1_000).toFixed(0).replace(".", ",")}K`;
  }

  return `$${value.toFixed(0).replace(".", ",")}`;
}

/**
 * Format number for display in es-CL locale (no currency)
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-CL").format(value);
}

/**
 * Parse period string and validate format
 * Returns { year, month, period }
 */
export function parsePeriodSafely(periodStr: string) {
  return safeParsePeriod(periodStr);
}

/**
 * Build monthly chart data for a single year
 * Groups DTESummary by month with defaults for missing months
 */
export function buildMonthlyChartData(summary: DTESummaryRaw[], year: string): MonthlyChartData[] {
  // Validate input
  validateDTESummaryArray(summary);

  // Build index map for O(1) lookup
  const monthMap = new Map<string, DTESummaryRaw>();
  for (const item of summary) {
    monthMap.set(item.period, item);
  }

  // Build complete 12-month dataset
  return Array.from({ length: 12 }, (_, i): MonthlyChartData => {
    const month = (i + 1).toString().padStart(2, "0");
    const period = `${year}-${month}`;
    const item = monthMap.get(period);

    return {
      month: getMonthName(i),
      totalAmount: item?.totalAmount ?? 0,
      exemptAmount: item?.exemptAmount ?? 0,
      netAmount: item?.netAmount ?? 0,
      taxAmount: item?.taxAmount ?? 0,
      averageAmount: item?.averageAmount ?? 0,
      count: item?.count ?? 0,
    };
  });
}

/**
 * Calculate yearly totals from monthly data
 */
export function calculateYearlyTotals(data: MonthlyChartData[]): YearlyTotals {
  return {
    totalAmount: data.reduce((sum, d) => sum + d.totalAmount, 0),
    exemptAmount: data.reduce((sum, d) => sum + d.exemptAmount, 0),
    netAmount: data.reduce((sum, d) => sum + d.netAmount, 0),
    taxAmount: data.reduce((sum, d) => sum + d.taxAmount, 0),
    averageAmount: data.reduce((sum, d) => sum + d.averageAmount, 0) / 12,
    count: data.reduce((sum, d) => sum + d.count, 0),
  };
}

/**
 * Build comparison chart data for multiple years
 * Groups by month with dynamic year columns
 */
export function buildComparisonChartData(summary: DTESummaryRaw[]): ComparisonChartData[] {
  // Validate input
  validateDTESummaryArray(summary);

  // Build intermediate structure: monthStr -> year[] with data
  const monthYearMap = new Map<string, Array<DTESummaryRaw & { year: string }>>();

  for (const item of summary) {
    const { year } = parsePeriodSafely(item.period);
    const monthStr = item.period.split("-")[1]; // MM part

    if (!monthStr) {
      console.warn(`Invalid period format: ${item.period}`);
      continue;
    }

    if (!monthYearMap.has(monthStr)) {
      monthYearMap.set(monthStr, []);
    }

    const monthData = monthYearMap.get(monthStr);
    if (monthData) {
      monthData.push({ ...item, year });
    }
  }

  // Transform to chart data structure
  return Array.from({ length: 12 }, (_, i): ComparisonChartData => {
    const monthStr = (i + 1).toString().padStart(2, "0");
    const monthItems = monthYearMap.get(monthStr) ?? [];

    const dataPoint: ComparisonChartData = {
      month: getMonthName(i),
    };

    // Add each year's total amount as a column
    for (const item of monthItems) {
      dataPoint[item.year] = item.totalAmount;
    }

    return dataPoint;
  });
}

/**
 * Extract unique years from summary data, sorted descending
 */
export function extractYearsFromSummary(summary: DTESummaryRaw[]): string[] {
  const yearSet = new Set<string>();

  for (const item of summary) {
    try {
      const { year } = parsePeriodSafely(item.period);
      yearSet.add(year);
    } catch (err) {
      console.warn(`Failed to extract year from period: ${item.period}`, err);
    }
  }

  return Array.from(yearSet).sort().reverse();
}

/**
 * Validate year selection against available options
 */
export function isValidYearOption(year: string, options: readonly string[]): boolean {
  return options.includes(year);
}

/**
 * Safely update year selection
 * Returns new year if valid, falls back to first option
 */
export function safeYearSelection(selectedYear: string, yearOptions: readonly string[]): string {
  if (isValidYearOption(selectedYear, yearOptions)) {
    return selectedYear;
  }
  return yearOptions[0] ?? new Date().getFullYear().toString();
}
