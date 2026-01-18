import { Decimal } from "decimal.js";

export type CurrencyValue = Decimal | null | number | object | string | undefined;

export function addCurrency(a: CurrencyValue, b: CurrencyValue): number {
  return toDecimal(a).plus(toDecimal(b)).round().toNumber();
}

/**
 * Round currency to whole numbers (CLP has no decimals)
 * Uses Decimal.js for precise rounding (ROUND_HALF_UP default)
 */
export function roundCurrency(value: CurrencyValue): number {
  return toDecimal(value).round().toNumber();
}

export function subtractCurrency(a: CurrencyValue, b: CurrencyValue): number {
  return toDecimal(a).minus(toDecimal(b)).round().toNumber();
}

/**
 * Safely convert any value to a Decimal instance.
 * Returns Decimal(0) for null/undefined/invalid inputs.
 */
export function toDecimal(value: CurrencyValue): Decimal {
  if (value === null || value === undefined) return new Decimal(0);
  if (value instanceof Decimal) return value;

  try {
    // Handle specific object cases if necessary, or rely on string conversion
    // decimal.js handles numbers and numeric strings well.
    return new Decimal(String(value as number | string));
  } catch {
    return new Decimal(0);
  }
}
