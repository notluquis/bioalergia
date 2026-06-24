/**
 * Tests for inventory `queries.ts` — TanStack Query keys + queryFn wiring.
 *
 * Mocks the api layer (module boundary), asserts queryKey shapes are
 * stable (cache invariant), queryFn forwards filters, and cursor
 * pagination propagates `pageParam` from `getNextPageParam`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  fetchAllergyOverview: vi.fn(),
  getInventoryCategories: vi.fn(),
  getInventoryItems: vi.fn(),
  listInventoryMovements: vi.fn(),
}));

vi.mock("./api", () => apiMocks);

const { inventoryQueries } = await import("./queries");

describe("inventory/queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("movements()", () => {
    it("builds a stable queryKey including filters", () => {
      const opts = inventoryQueries.movements({ item_id: 7, search: "histamina" });
      expect(opts.queryKey).toEqual([
        "inventory",
        "movements",
        { item_id: 7, search: "histamina" },
      ]);
    });

    it("queryKey defaults to empty filters object when args omitted", () => {
      expect(inventoryQueries.movements().queryKey).toEqual(["inventory", "movements", {}]);
    });

    it("queryFn forwards all filters + pageParam (cursor) to listInventoryMovements", async () => {
      apiMocks.listInventoryMovements.mockResolvedValue({
        data: { movements: [], next_cursor: null },
        status: "ok",
      });

      const opts = inventoryQueries.movements({
        from: "2026-01-01",
        item_id: 3,
        limit: 25,
        search: "polvo",
        to: "2026-05-18",
      });

      // queryFn signature uses pageParam from getNextPageParam
      const ctx = { pageParam: 42 } as unknown as Parameters<NonNullable<typeof opts.queryFn>>[0];
      const queryFn = opts.queryFn;
      if (typeof queryFn !== "function") throw new Error("queryFn missing");
      await queryFn(ctx);

      expect(apiMocks.listInventoryMovements).toHaveBeenCalledWith({
        cursor: 42,
        from: "2026-01-01",
        item_id: 3,
        limit: 25,
        search: "polvo",
        to: "2026-05-18",
      });
    });

    it("first-page queryFn passes undefined cursor (initialPageParam)", async () => {
      apiMocks.listInventoryMovements.mockResolvedValue({
        data: { movements: [], next_cursor: null },
        status: "ok",
      });

      const opts = inventoryQueries.movements();
      const ctx = { pageParam: opts.initialPageParam } as unknown as Parameters<
        NonNullable<typeof opts.queryFn>
      >[0];
      const queryFn = opts.queryFn;
      if (typeof queryFn !== "function") throw new Error("queryFn missing");
      await queryFn(ctx);

      expect(apiMocks.listInventoryMovements).toHaveBeenCalledWith({
        cursor: undefined,
        from: undefined,
        item_id: undefined,
        limit: undefined,
        search: undefined,
        to: undefined,
      });
    });

    it("getNextPageParam returns next_cursor when present", () => {
      const opts = inventoryQueries.movements();
      const next = opts.getNextPageParam(
        { data: { movements: [], next_cursor: 99 }, status: "ok" },
        [],
        undefined,
        []
      );
      expect(next).toBe(99);
    });

    it("getNextPageParam returns undefined when no more pages", () => {
      const opts = inventoryQueries.movements();
      const next = opts.getNextPageParam(
        { data: { movements: [], next_cursor: null }, status: "ok" },
        [],
        undefined,
        []
      );
      expect(next).toBeUndefined();
    });
  });

  describe("existing keys are stable", () => {
    it("items key", () => {
      expect(inventoryQueries.items().queryKey).toEqual(["inventory", "items"]);
    });

    it("categories key", () => {
      expect(inventoryQueries.categories().queryKey).toEqual(["inventory", "categories"]);
    });

    it("allergyOverview key", () => {
      expect(inventoryQueries.allergyOverview().queryKey).toEqual([
        "inventory",
        "allergy-overview",
      ]);
    });
  });
});
