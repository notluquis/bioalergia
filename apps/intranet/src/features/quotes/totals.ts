// Réplica cliente de `computeQuoteTotals` del API (apps/api/src/services/quotes.ts)
// para el preview en vivo. IVA 19% sobre base afecta − descuento global; CLP entero.

export type QuoteLineLike = {
  quantity: number;
  unitPrice: number;
  discount: number;
  exempt: boolean;
};

export function lineSubtotal(item: QuoteLineLike): number {
  return Math.max(0, item.quantity * item.unitPrice - (item.discount ?? 0));
}

export type QuoteTotals = {
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
};

export function computeQuoteTotals(
  items: QuoteLineLike[],
  discount: number,
  taxRate: number
): QuoteTotals {
  let afecto = 0;
  let exento = 0;
  for (const item of items) {
    const sub = lineSubtotal(item);
    if (item.exempt) exento += sub;
    else afecto += sub;
  }
  const subtotal = afecto + exento;
  const afectoNet = Math.max(0, afecto - discount);
  const taxAmount = Math.round((afectoNet * taxRate) / 100);
  const total = afectoNet + exento + taxAmount;
  return { subtotal, discount, taxRate, taxAmount, total };
}
