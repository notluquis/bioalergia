// Pure product-detail helpers, extracted from routes/producto/$slug.tsx so they
// are unit-testable without a React renderer. Behavior is byte-identical to the
// original inline expressions.

/**
 * The largest quantity a customer may add for a product: bounded below by 1 and
 * above by 99, derived from sellable stock (`available_qty - safety_stock`).
 * Mirrors `Math.min(99, Math.max(1, product.available_qty - product.safety_stock))`.
 */
export function maxAddableQty(availableQty: number, safetyStock: number): number {
  return Math.min(99, Math.max(1, availableQty - safetyStock));
}

/**
 * Whether a strikethrough "compare at" price should show: it exists and is
 * strictly greater than the current price. Mirrors
 * `compare_at_price_clp && compare_at_price_clp > price_clp`.
 */
export function hasCompareAtSaving(
  priceClp: number,
  compareAtPriceClp: number | null | undefined
): boolean {
  return typeof compareAtPriceClp === "number" && compareAtPriceClp > priceClp;
}
