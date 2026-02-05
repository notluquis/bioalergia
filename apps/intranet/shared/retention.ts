/**
 * Retention rate utilities
 * Chilean labor law retention rates by year
 */

/**
 * Format retention rate as percentage string for display
 * E.g., 0.145 -> "14,5"  |  0.1525 -> "15,25"
 */
export function formatRetentionPercent(rate: number): string {
  if (!rate || Number.isNaN(rate)) {
    return "0,0";
  }
  const percent = rate * 100;
  // Use 2 decimals if needed (e.g., 15.25), otherwise 1 (e.g., 14.5)
  let formatted: string;
  if (percent % 1 === 0) {
    formatted = percent.toFixed(1);
  } else if ((percent * 10) % 1 === 0) {
    formatted = percent.toFixed(1);
  } else {
    formatted = percent.toFixed(2);
  }
  return formatted.replace(".", ",");
}

/**
 * Get effective retention rate for an employee
 * If employee has a custom rate (not a default), use it
 * Otherwise use the standard rate for the given year
 */
export function getEffectiveRetentionRate(
  employeeRate: null | number | undefined,
  year: number,
): number {
  const yearRate = getRetentionRateForYear(year);

  // If employee has no rate, use year default
  if (!employeeRate) {
    return yearRate;
  }

  // If employee has custom rate (different from any historical default), use it
  const isDefaultRate = employeeRate === 0.145 || employeeRate === 0.1525;
  if (!isDefaultRate) {
    return employeeRate;
  }

  // Employee has a default rate, use the year's rate
  return yearRate;
}

/**
 * Get standard retention rate for a given year
 * - 2025 and before: 14.5%
 * - 2026 and after: 15.25%
 */
export function getRetentionRateForYear(year: number): number {
  if (year <= 2025) {
    return 0.145; // 14.5%
  }
  return 0.1525; // 15.25%
}
