export type CurrencyValue = number | string | object | null | undefined;

/**
 * Round currency to whole numbers (CLP has no decimals)
 */
export function roundCurrency(value: CurrencyValue): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (Number.isNaN(num)) return 0;
  return Math.round(num);
}

export function addCurrency(a: CurrencyValue, b: CurrencyValue): number {
  if (a === null || a === undefined) a = 0;
  if (b === null || b === undefined) b = 0;
  const valA = typeof a === "number" ? a : Number.parseFloat(String(a));
  const valB = typeof b === "number" ? b : Number.parseFloat(String(b));
  return roundCurrency(valA + valB);
}

export function subtractCurrency(a: CurrencyValue, b: CurrencyValue): number {
  if (a === null || a === undefined) a = 0;
  if (b === null || b === undefined) b = 0;
  const valA = typeof a === "number" ? a : Number.parseFloat(String(a));
  const valB = typeof b === "number" ? b : Number.parseFloat(String(b));
  return roundCurrency(valA - valB);
}
