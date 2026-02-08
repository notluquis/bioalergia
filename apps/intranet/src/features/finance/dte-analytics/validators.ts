/**
 * DTE Analytics - Zod Validators
 * Strict runtime validation following Zod best practices
 */

import { z } from "zod";
import type { DTESummaryRaw } from "./types";

/**
 * Period validator: ensures YYYY-MM format where MM is 01-12
 */
const PeriodValidator = z.string().regex(/^\d{4}-\d{2}$/, {
  message: 'Period must be in YYYY-MM format (e.g., "2024-01")',
});

/**
 * Year validator: ensures YYYY format and 4-digit year
 */
const YearValidator = z.string().regex(/^\d{4}$/, {
  message: "Year must be 4 digits",
});

/**
 * Month validator: ensures 01-12 range
 */
const MonthValidator = z.string().regex(/^(0[1-9]|1[0-2])$/, {
  message: "Month must be between 01 and 12",
});

/**
 * Numeric amount validator: ensures non-negative numbers
 */
const AmountValidator = z.number().nonnegative("Amount must be non-negative");

/**
 * Raw DTE Summary schema
 */
export const DTESummaryRawSchema = z.object({
  period: PeriodValidator,
  count: z.number().int().nonnegative("Count must be non-negative integer"),
  totalAmount: AmountValidator,
  netAmount: AmountValidator,
  taxAmount: AmountValidator,
  averageAmount: AmountValidator,
}) satisfies z.ZodType<DTESummaryRaw>;

/**
 * Array of DTE Summaries
 */
export const DTESummaryArraySchema = z.array(DTESummaryRawSchema);

/**
 * Response wrapper for API endpoints
 */
export const DTESummaryResponseSchema = z.object({
  status: z.literal("success"),
  data: DTESummaryArraySchema,
});

/**
 * Period parsing schema
 */
export const ParsedPeriodSchema = z.object({
  year: YearValidator,
  month: MonthValidator,
  period: PeriodValidator,
});

/**
 * Year array schema
 */
export const YearArraySchema = z.array(YearValidator);

/**
 * Type inference from Zod schemas
 */
export type DTESummaryResponse = z.infer<typeof DTESummaryResponseSchema>;
export type ParsedPeriod = z.infer<typeof ParsedPeriodSchema>;

/**
 * Safe validation function
 */
export function validateDTESummary(data: unknown): DTESummaryRaw {
  const result = DTESummaryRawSchema.safeParse(data);
  if (!result.success) {
    const formatted = result.error.issues
      .map((err) => `${err.path.join(".")}: ${err.message}`)
      .join("; ");
    throw new TypeError(`Invalid DTESummary: ${formatted}`);
  }
  return result.data;
}

/**
 * Batch validation for arrays
 */
export function validateDTESummaryArray(data: unknown): DTESummaryRaw[] {
  const result = DTESummaryArraySchema.safeParse(data);
  if (!result.success) {
    const formatted = result.error.issues
      .slice(0, 3)
      .map((err) => `Index ${err.path.join(".")}: ${err.message}`)
      .join("; ");
    const suffix = result.error.issues.length > 3 ? "..." : "";
    throw new TypeError(`Invalid DTESummary array: ${formatted}${suffix}`);
  }
  return result.data;
}

/**
 * Safe period parsing with validation
 */
export function safeParsePeriod(period: string): ParsedPeriod {
  if (!period.includes("-")) {
    throw new TypeError(`Period must contain "-" separator: "${period}"`);
  }

  const parts = period.split("-");
  const [year, month] = [parts[0] ?? "", parts[1] ?? ""];

  const result = ParsedPeriodSchema.safeParse({
    year,
    month,
    period,
  });

  if (!result.success) {
    throw new TypeError(
      `Invalid period "${period}": ${result.error.issues.map((e) => e.message).join(", ")}`,
    );
  }

  return result.data;
}

/**
 * Safe year extraction from period string
 */
export function extractYearFromPeriod(period: string): string {
  const { year } = safeParsePeriod(period);
  return year;
}

/**
 * Type predicate for DTE summary
 */
export function isValidDTESummary(data: unknown): data is DTESummaryRaw {
  return DTESummaryRawSchema.safeParse(data).success;
}

/**
 * Type predicate for validated period
 */
export function isParsedPeriodValid(value: string): boolean {
  return PeriodValidator.safeParse(value).success;
}
