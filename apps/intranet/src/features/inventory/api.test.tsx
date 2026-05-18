/**
 * Tests for `@/features/inventory/api` — oRPC wrappers + zod parsing of
 * the inventory CRUD + stock-movement endpoints.
 *
 * Coverage:
 * - CRUD happy paths (item / category / movement).
 * - Schema validation failures surface ApiError.
 * - `fetchAllergyOverview` flattens the `last_price_check` /
 *   `last_stock_check` Date fields to ISO strings (this transform is
 *   load-bearing for the allergy inventory dashboard — regression-prone).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

const orpc = vi.hoisted(() => ({
  createCategory: vi.fn(),
  createItem: vi.fn(),
  createMovement: vi.fn(),
  deleteCategory: vi.fn(),
  deleteItem: vi.fn(),
  allergyOverview: vi.fn(),
  listCategories: vi.fn(),
  listItems: vi.fn(),
  updateItem: vi.fn(),
}));

vi.mock("./orpc", () => ({
  inventoryORPCClient: orpc,
  toInventoryApiError: (e: unknown) => {
    if (e instanceof ApiError) return e;
    if (e instanceof Error) return new ApiError(e.message, 500);
    return new ApiError("unexpected", 500, e);
  },
}));

const {
  createInventoryCategory,
  createInventoryItem,
  createInventoryMovement,
  deleteInventoryCategory,
  deleteInventoryItem,
  fetchAllergyOverview,
  getInventoryCategories,
  getInventoryItems,
  updateInventoryItem,
} = await import("./api");

const baseItem = {
  id: 1,
  name: "Histamina 1mg/mL",
  description: "Control positivo",
  category_id: 3,
  current_stock: 25,
};

describe("inventory/api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("items CRUD", () => {
    it("getInventoryItems returns the parsed item array", async () => {
      orpc.listItems.mockResolvedValue({ data: [baseItem] });
      const items = await getInventoryItems();
      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe("Histamina 1mg/mL");
    });

    it("createInventoryItem unwraps `data` and returns the persisted row", async () => {
      orpc.createItem.mockResolvedValue({ data: { ...baseItem, id: 9 } });
      const result = await createInventoryItem({
        name: baseItem.name,
        description: baseItem.description,
        category_id: 3,
        current_stock: 0,
      });
      expect(result.id).toBe(9);
      expect(orpc.createItem).toHaveBeenCalledWith({
        name: baseItem.name,
        description: baseItem.description,
        category_id: 3,
        current_stock: 0,
      });
    });

    it("updateInventoryItem forwards id + patch and returns the parsed row", async () => {
      orpc.updateItem.mockResolvedValue({ data: { ...baseItem, current_stock: 99 } });
      const result = await updateInventoryItem(1, { current_stock: 99 });
      expect(orpc.updateItem).toHaveBeenCalledWith({ id: 1, item: { current_stock: 99 } });
      expect(result.current_stock).toBe(99);
    });

    it("deleteInventoryItem forwards the id", async () => {
      orpc.deleteItem.mockResolvedValue(undefined);
      await deleteInventoryItem(1);
      expect(orpc.deleteItem).toHaveBeenCalledWith({ id: 1 });
    });

    it("invalid server payload becomes an ApiError on listItems", async () => {
      orpc.listItems.mockResolvedValue({ data: [{ id: "bad" }] });
      await expect(getInventoryItems()).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("categories", () => {
    it("getInventoryCategories returns parsed categories", async () => {
      orpc.listCategories.mockResolvedValue({
        data: [{ id: 1, name: "Aeroalérgenos" }],
      });
      const result = await getInventoryCategories();
      expect(result[0]?.name).toBe("Aeroalérgenos");
    });

    it("createInventoryCategory unwraps `data`", async () => {
      orpc.createCategory.mockResolvedValue({
        data: { id: 1, name: "Alimentos" },
      });
      const result = await createInventoryCategory("Alimentos");
      expect(result.id).toBe(1);
      expect(orpc.createCategory).toHaveBeenCalledWith({ name: "Alimentos" });
    });

    it("deleteInventoryCategory forwards the id", async () => {
      orpc.deleteCategory.mockResolvedValue(undefined);
      await deleteInventoryCategory(7);
      expect(orpc.deleteCategory).toHaveBeenCalledWith({ id: 7 });
    });
  });

  describe("stock movements (audit log)", () => {
    it("createInventoryMovement forwards the payload verbatim", async () => {
      orpc.createMovement.mockResolvedValue(undefined);
      const movement = {
        item_id: 1,
        quantity: -5,
        movement_type: "out" as const,
        reason: "Pinchazo paciente",
      } as Parameters<typeof createInventoryMovement>[0];
      await createInventoryMovement(movement);
      expect(orpc.createMovement).toHaveBeenCalledWith(movement);
    });

    it("propagates errors as ApiError", async () => {
      orpc.createMovement.mockRejectedValue(new Error("stock < 0 prohibido"));
      await expect(
        createInventoryMovement({
          item_id: 1,
          quantity: -999,
          movement_type: "out",
        } as Parameters<typeof createInventoryMovement>[0])
      ).rejects.toMatchObject({ name: "ApiError", message: "stock < 0 prohibido" });
    });
  });

  describe("fetchAllergyOverview", () => {
    it("transforms provider date fields to ISO strings (or null)", async () => {
      const stockDate = new Date("2026-04-01T10:00:00Z");
      orpc.allergyOverview.mockResolvedValue({
        data: [
          {
            item_id: 1,
            name: "Gato Felis Domesticus",
            description: null,
            current_stock: 10,
            category: { id: 1, name: "Aeroalérgenos" },
            allergy_type: { type: { id: 1, name: "Animal" } },
            providers: [
              {
                provider_id: 1,
                provider_name: "Proveedor X",
                provider_rut: "76543210-K",
                accounts: ["acc-1"],
                current_price: 12_500,
                last_price_check: null,
                last_stock_check: stockDate,
              },
            ],
          },
        ],
      });

      const result = await fetchAllergyOverview();
      const provider = result[0]?.providers[0];
      expect(provider?.last_price_check).toBeNull();
      expect(provider?.last_stock_check).toBe(stockDate.toISOString());
    });

    it("surfaces malformed payloads as ApiError", async () => {
      orpc.allergyOverview.mockResolvedValue({ data: [{ wrong: "shape" }] });
      await expect(fetchAllergyOverview()).rejects.toBeInstanceOf(ApiError);
    });
  });
});
