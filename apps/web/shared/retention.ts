/**
 * Retention rate utilities
 * Chilean labor law retention rates by year
 */

/**
 * Get standard retention rate for a given year
 * - 2025 and before: 14.5%
 * - 2026 and after: 15.25%
 */
export function getRetentionRateForYear(year: number): number {
  if (year <= 2025) return 0.145; // 14.5%
  return 0.1525; // 15.25%
}

/**
 * Get effective retention rate for an employee
 * If employee has a custom rate (not a default), use it
 * Otherwise use the standard rate for the given year
 */
export function getEffectiveRetentionRate(employeeRate: number | undefined | null, year: number): number {
  const yearRate = getRetentionRateForYear(year);

  // If employee has no rate, use year default
  if (!employeeRate) return yearRate;

  // If employee has custom rate (different from any historical default), use it
  const isDefaultRate = employeeRate === 0.145 || employeeRate === 0.1525;
  if (!isDefaultRate) {
    return employeeRate;
  }

  // Employee has a default rate, use the year's rate
  return yearRate;
}

/**
 * Format retention rate as percentage string for display
 * E.g., 0.145 -> "14,5"
 */
export function formatRetentionPercent(rate: number): string {
  return (rate * 100).toFixed(1).replace(".", ",");
}
