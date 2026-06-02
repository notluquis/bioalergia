/**
 * `computeQuoteTotals` cliente — réplica del cálculo del API para el preview en
 * vivo. Debe coincidir exactamente con apps/api/src/services/quotes.ts.
 */
import { describe, expect, it } from "vitest";
import { computeQuoteTotals, lineSubtotal, type QuoteLineLike } from "./totals";

const line = (
  quantity: number,
  unitPrice: number,
  extra?: { discount?: number; exempt?: boolean }
): QuoteLineLike => ({
  quantity,
  unitPrice,
  discount: extra?.discount ?? 0,
  exempt: extra?.exempt ?? false,
});

describe("lineSubtotal", () => {
  it("qty × precio − descuento, nunca negativo", () => {
    expect(lineSubtotal(line(2, 10000, { discount: 5000 }))).toBe(15000);
    expect(lineSubtotal(line(1, 1000, { discount: 5000 }))).toBe(0);
  });
});

describe("computeQuoteTotals (cliente)", () => {
  it("IVA 19% caso imagen 1", () => {
    const items = Array.from({ length: 16 }, () => line(1, 38500));
    const t = computeQuoteTotals(items, 0, 19);
    expect(t.subtotal).toBe(616000);
    expect(t.taxAmount).toBe(117040);
    expect(t.total).toBe(733040);
  });

  it("descuento global antes del IVA", () => {
    const t = computeQuoteTotals([line(1, 100000)], 20000, 19);
    expect(t.taxAmount).toBe(15200);
    expect(t.total).toBe(95200);
  });

  it("exentos no tributan", () => {
    const t = computeQuoteTotals([line(1, 100000, { exempt: true }), line(1, 100000)], 0, 19);
    expect(t.taxAmount).toBe(19000);
    expect(t.total).toBe(219000);
  });

  it("redondea IVA a entero", () => {
    const t = computeQuoteTotals([line(1, 333)], 0, 19);
    expect(t.taxAmount).toBe(63);
  });
});
