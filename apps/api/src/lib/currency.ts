/**
 * Round currency to whole numbers (CLP has no decimals)
 */
export function roundCurrency(value: number): number {
  return Math.round(value);
}

export function addCurrency(a: number, b: number): number {
  return roundCurrency(a + b);
}
