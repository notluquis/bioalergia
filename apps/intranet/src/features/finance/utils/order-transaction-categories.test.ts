import { describe, expect, it } from "vitest";
import {
  buildCategoryFrequencyMap,
  orderTransactionCategoriesByFrequency,
} from "./order-transaction-categories";

describe("orderTransactionCategoriesByFrequency", () => {
  it("sorts categories by descending frequency with stable tie-breakers", () => {
    const categories = [
      { id: 4, name: "Ventas", type: "INCOME" as const },
      { id: 3, name: "Arriendo", type: "EXPENSE" as const },
      { id: 2, name: "Comidas", type: "EXPENSE" as const },
      { id: 1, name: "Bencina", type: "EXPENSE" as const },
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
});
