/**
 * `computeQuoteTotals` — núcleo de la cotización (base afecta, IVA, exentos,
 * descuento global, redondeo CLP). El módulo importa el cliente db, así que lo
 * mockeamos aunque la función bajo test sea pura (patrón golden de test mocks).
 */
import { describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = { $setOptions: () => mockDb };
  return { mockDb };
});
vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { computeQuoteTotals } = await import("./quotes.ts");

type Item = {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  exempt: boolean;
};
const line = (
  quantity: number,
  unitPrice: number,
  extra?: { discount?: number; exempt?: boolean }
): Item => ({
  description: "x",
  quantity,
  unitPrice,
  discount: extra?.discount ?? 0,
  exempt: extra?.exempt ?? false,
});

describe("computeQuoteTotals", () => {
  it("IVA 19% sobre líneas afectas (caso real imagen 1)", () => {
    // 16 líneas × $38.500 = $616.000 → IVA 117.040 → total 733.040
    const items = Array.from({ length: 16 }, () => line(1, 38500));
    const t = computeQuoteTotals(items, 0, 19);
    expect(t.subtotal).toBe(616000);
    expect(t.taxAmount).toBe(117040);
    expect(t.total).toBe(733040);
  });

  it("descuento por línea: qty×precio − descuento", () => {
    const t = computeQuoteTotals([line(2, 10000, { discount: 5000 })], 0, 19);
    expect(t.subtotal).toBe(15000); // 20000 - 5000
    expect(t.taxAmount).toBe(2850); // 15000 × 0.19
    expect(t.total).toBe(17850);
  });

  it("descuento global reduce la base afecta antes del IVA", () => {
    const t = computeQuoteTotals([line(1, 100000)], 20000, 19);
    expect(t.subtotal).toBe(100000);
    expect(t.taxAmount).toBe(15200); // (100000 - 20000) × 0.19
    expect(t.total).toBe(95200); // 80000 + 15200
  });

  it("líneas exentas no tributan", () => {
    const t = computeQuoteTotals([line(1, 100000, { exempt: true }), line(1, 100000)], 0, 19);
    expect(t.subtotal).toBe(200000);
    expect(t.taxAmount).toBe(19000); // sólo los 100000 afectos
    expect(t.total).toBe(219000); // 100000 exento + 100000 afecto + 19000 IVA
  });

  it("redondea el IVA a entero (CLP)", () => {
    const t = computeQuoteTotals([line(1, 333)], 0, 19);
    expect(Number.isInteger(t.taxAmount)).toBe(true);
    expect(t.taxAmount).toBe(63); // round(333 × 0.19 = 63.27)
  });

  it("descuento mayor que la base no produce IVA negativo", () => {
    const t = computeQuoteTotals([line(1, 10000)], 50000, 19);
    expect(t.taxAmount).toBe(0);
    expect(t.total).toBe(0);
  });

  it("subtotal de línea nunca es negativo", () => {
    const t = computeQuoteTotals([line(1, 1000, { discount: 5000 })], 0, 19);
    expect(t.subtotal).toBe(0);
  });
});
