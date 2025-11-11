import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQuery = vi.fn();

vi.mock("../server/db.js", () => ({
  getPool: () => ({
    query: mockQuery,
  }),
}));

describe("listAllergyInventoryOverview", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("groups providers and builds the hierarchy", async () => {
    const rows = [
      {
        item_id: 1,
        item_name: "Dermatophagoides pteronyssinus",
        description: "Der p",
        current_stock: 10,
        category_id: 5,
        category_name: "Ácaros",
        subtype_id: 101,
        subtype_name: "Der p",
        parent_id: 10,
        parent_name: "Ácaros totales",
        root_id: 1,
        root_name: "Reactivos",
      },
    ];
    const providerRows = [
      {
        item_id: 1,
        provider_id: 33,
        current_price: 12345,
        last_stock_check: "2025-01-01 00:00:00",
        last_price_check: "2025-01-02 00:00:00",
        provider_name: "Laboratorio A",
        provider_rut: "76.123.456-7",
        account_identifier: "00112233",
      },
    ];

    mockQuery.mockResolvedValueOnce([rows]);
    mockQuery.mockResolvedValueOnce([providerRows]);

    const { listAllergyInventoryOverview } = await import("../server/repositories/inventory.js");
    const overview = await listAllergyInventoryOverview();

    expect(overview).toHaveLength(1);
    const item = overview[0];
    expect(item.allergy_type.type?.name).toBe("Reactivos");
    expect(item.providers).toHaveLength(1);
    expect(item.providers[0].accounts).toEqual(["00112233"]);
    expect(item.providers[0].current_price).toBe(12345);
  });
});
