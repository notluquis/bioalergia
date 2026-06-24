// Pure cart line/total math, extracted from routes/carrito.tsx +
// routes/checkout.tsx so it is unit-testable without a React renderer.
// Behavior is byte-identical to the original inline expressions.

/** Minimal structural shape a cart line needs for math. */
export type CartLine = { unit_price_clp: number; qty: number };

/**
 * The CLP total for a single cart line: `unit_price_clp * qty`.
 * Mirrors `item.unit_price_clp * item.qty` used in carrito + checkout summaries.
 */
export function lineTotalClp(unitPriceClp: number, qty: number): number {
  return unitPriceClp * qty;
}

/**
 * Sum of `qty` across all lines (total units in the cart, not distinct lines).
 * Returns 0 for an empty array.
 */
export function cartItemCount(items: readonly CartLine[]): number {
  return items.reduce((sum, item) => sum + item.qty, 0);
}
