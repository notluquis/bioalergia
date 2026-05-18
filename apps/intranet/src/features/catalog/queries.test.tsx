/**
 * Tests for catalog `queries.ts` — TanStack Query keys + queryFn wiring.
 *
 * Golden 2026 patterns: mock the api layer (module boundary), assert
 * queryKey shapes are stable (TanStack Query cache invariant) and that
 * the queryFn forwards expected args.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getProductById: vi.fn(),
  getCategories: vi.fn(),
}));

vi.mock("./api", () => apiMocks);

const { catalogKeys } = await import("./queries");

describe("catalog/queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("all key is stable", () => {
    expect(catalogKeys.all).toEqual(["catalog"]);
  });

  describe("products()", () => {
    it("builds a stable queryKey including opts", () => {
      const opts = catalogKeys.products({ includeInactive: true, q: "foo" });
      expect(opts.queryKey).toEqual(["catalog", "products", { includeInactive: true, q: "foo" }]);
    });

    it("queryKey defaults to empty object when opts omitted", () => {
      expect(catalogKeys.products().queryKey).toEqual(["catalog", "products", {}]);
    });

    it("queryFn forwards opts to getProducts", async () => {
      apiMocks.getProducts.mockResolvedValue({ data: [] });
      const opts = catalogKeys.products({ includeInactive: true, q: "isdin" });
      await opts.queryFn!({} as never);
      expect(apiMocks.getProducts).toHaveBeenCalledWith({
        includeInactive: true,
        q: "isdin",
      });
    });
  });

  describe("product(id)", () => {
    it("builds keyed query by id", () => {
      const opts = catalogKeys.product(7);
      expect(opts.queryKey).toEqual(["catalog", "product", 7]);
    });

    it("queryFn forwards id to getProductById", async () => {
      apiMocks.getProductById.mockResolvedValue({ data: { id: 7 } });
      await catalogKeys.product(7).queryFn!({} as never);
      expect(apiMocks.getProductById).toHaveBeenCalledWith(7);
    });
  });

  describe("categories()", () => {
    it("builds key", () => {
      expect(catalogKeys.categories().queryKey).toEqual(["catalog", "categories"]);
    });

    it("queryFn calls getCategories", async () => {
      apiMocks.getCategories.mockResolvedValue({ data: [] });
      await catalogKeys.categories().queryFn!({} as never);
      expect(apiMocks.getCategories).toHaveBeenCalled();
    });
  });
});
