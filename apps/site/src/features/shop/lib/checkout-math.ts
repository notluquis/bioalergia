// Pure checkout math, extracted from routes/checkout.tsx so it is unit-testable
// without a React renderer. Behavior is byte-identical to the original inline
// expressions (`(cart?.total_clp ?? 0) + shippingClp` and the cheapest-option
// sort).

/** Minimal structural shape of a Chilexpress quote option (cost-bearing). */
export type ShippingOption = { shipping_clp: number };

/**
 * Order grand total = cart total + shipping.
 * Mirrors `(cart?.total_clp ?? 0) + shippingClp`; pass `0` for a missing cart
 * total at the call site so the function stays total (no optional handling).
 */
export function computeOrderTotal(cartTotalClp: number, shippingClp: number): number {
  return cartTotalClp + shippingClp;
}

/**
 * Returns the cheapest shipping option by `shipping_clp`, or `undefined` for an
 * empty list. Does not mutate the input (sorts a copy), matching the original
 * `[...options].sort((a, b) => a.shipping_clp - b.shipping_clp)[0]`.
 */
export function pickCheapestShippingOption<T extends ShippingOption>(
  options: readonly T[]
): T | undefined {
  return [...options].sort((a, b) => a.shipping_clp - b.shipping_clp)[0];
}
