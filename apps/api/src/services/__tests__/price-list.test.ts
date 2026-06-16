import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    priceListItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { mockDb };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { listPriceListItems, upsertPriceListItem, deletePriceListItem } =
  await import("../price-list.ts");

const BASE_INPUT = {
  name: "Consulta inmunología",
  category: "Consultas",
  unit: "unidad",
  priceClp: 25000,
  isActive: true,
  sortOrder: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.priceListItem.findMany.mockResolvedValue([]);
  mockDb.priceListItem.findUnique.mockResolvedValue(null);
  mockDb.priceListItem.create.mockResolvedValue({ id: "new-id" });
  mockDb.priceListItem.update.mockResolvedValue({ id: "existing-id" });
  mockDb.priceListItem.delete.mockResolvedValue({});
});

describe("listPriceListItems", () => {
  it("lists ordered by category, sortOrder, name", async () => {
    await listPriceListItems();
    expect(mockDb.priceListItem.findMany).toHaveBeenCalledWith({
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
  });

  it("wraps the rows under items", async () => {
    mockDb.priceListItem.findMany.mockResolvedValue([{ id: "a" }]);
    const res = await listPriceListItems();
    expect(res).toEqual({ items: [{ id: "a" }] });
  });
});

describe("upsertPriceListItem", () => {
  it("creates when no id; normalizes empty code/notes to null", async () => {
    await upsertPriceListItem({ ...BASE_INPUT });
    expect(mockDb.priceListItem.update).not.toHaveBeenCalled();
    const call = mockDb.priceListItem.create.mock.calls[0][0];
    expect(call.data.code).toBeNull();
    expect(call.data.notes).toBeNull();
    expect(call.data.name).toBe("Consulta inmunología");
    expect(call.data.priceClp).toBe(25000);
    // no uniqueness check when no code provided
    expect(mockDb.priceListItem.findUnique).not.toHaveBeenCalled();
  });

  it("trims and persists the provided code", async () => {
    await upsertPriceListItem({ ...BASE_INPUT, code: "  CON-01  " });
    const call = mockDb.priceListItem.create.mock.calls[0][0];
    expect(call.data.code).toBe("CON-01");
    // uniqueness lookup uses the trimmed code
    expect(mockDb.priceListItem.findUnique).toHaveBeenCalledWith({
      where: { code: "CON-01" },
      select: { id: true },
    });
  });

  it("updates when id present and the row exists", async () => {
    mockDb.priceListItem.findUnique.mockResolvedValue({ id: "existing-id" });
    await upsertPriceListItem({ ...BASE_INPUT, id: "existing-id" });
    expect(mockDb.priceListItem.create).not.toHaveBeenCalled();
    const call = mockDb.priceListItem.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "existing-id" });
    expect(call.data.name).toBe("Consulta inmunología");
  });

  it("throws NOT_FOUND when updating a missing row", async () => {
    mockDb.priceListItem.findUnique.mockResolvedValue(null);
    await expect(upsertPriceListItem({ ...BASE_INPUT, id: "ghost" })).rejects.toThrow(
      /no encontrado/
    );
    expect(mockDb.priceListItem.update).not.toHaveBeenCalled();
  });

  it("throws CONFLICT when the code belongs to another row (create)", async () => {
    mockDb.priceListItem.findUnique.mockResolvedValue({ id: "other-id" });
    await expect(upsertPriceListItem({ ...BASE_INPUT, code: "DUP" })).rejects.toThrow(/código/);
    expect(mockDb.priceListItem.create).not.toHaveBeenCalled();
  });

  it("throws CONFLICT when the code belongs to another row (update)", async () => {
    mockDb.priceListItem.findUnique.mockResolvedValue({ id: "other-id" });
    await expect(upsertPriceListItem({ ...BASE_INPUT, id: "mine", code: "DUP" })).rejects.toThrow(
      /código/
    );
    expect(mockDb.priceListItem.update).not.toHaveBeenCalled();
  });

  it("allows updating the same row that owns the code (no conflict)", async () => {
    mockDb.priceListItem.findUnique.mockResolvedValue({ id: "mine" });
    await upsertPriceListItem({ ...BASE_INPUT, id: "mine", code: "OWN" });
    expect(mockDb.priceListItem.update).toHaveBeenCalled();
  });
});

describe("deletePriceListItem", () => {
  it("throws NOT_FOUND when the item does not exist", async () => {
    mockDb.priceListItem.findUnique.mockResolvedValue(null);
    await expect(deletePriceListItem("nope")).rejects.toThrow(/no encontrado/);
    expect(mockDb.priceListItem.delete).not.toHaveBeenCalled();
  });

  it("deletes when present", async () => {
    mockDb.priceListItem.findUnique.mockResolvedValue({ id: "existing-id" });
    const r = await deletePriceListItem("existing-id");
    expect(r).toEqual({ status: "ok" });
    expect(mockDb.priceListItem.delete).toHaveBeenCalledWith({
      where: { id: "existing-id" },
    });
  });
});
