import { describe, expect, it } from "vitest";
import {
  buildCategoryFrequencyMap,
  orderTransactionCategoriesByFrequency,
} from "./order-transaction-categories";

describe("orderTransactionCategoriesByFrequency", () => {
  it("sorts categories by descending frequency with stable tie-breakers", () => {
    const categories = [
      { id: 4, name: "Ventas" },
      { id: 3, name: "Arriendo" },
      { id: 2, name: "Comidas" },
      { id: 1, name: "Bencina" },
    ];
    const frequencies = buildCategoryFrequencyMap([
      { categoryId: 1 },
      { categoryId: 1 },
      { categoryId: 2 },
      { categoryId: 4 },
      { categoryId: 4 },
      { categoryId: 4 },
      { category: { id: 2 } },
    ]);

    expect(
      orderTransactionCategoriesByFrequency(categories, frequencies).map((cat) => cat.id)
    ).toEqual([4, 1, 2, 3]);
  });

  it("skips transactions with no category id (line 159 continue branch)", () => {
    const freqs = buildCategoryFrequencyMap([
      { categoryId: null },
      { category: null },
      {},
      { categoryId: 1 },
    ]);
    expect(freqs.get(1)).toBe(1);
    expect(freqs.size).toBe(1);
  });

  it("breaks tie by id when frequency and name match (line 177)", () => {
    const categories = [
      { id: 5, name: "Igual" },
      { id: 2, name: "Igual" },
    ];
    // both unknown to map -> freqDelta=0, nameDelta=0 -> id ordering ascending
    const ordered = orderTransactionCategoriesByFrequency(categories, new Map());
    expect(ordered.map((c) => c.id)).toStrictEqual([2, 5]);
  });
});
