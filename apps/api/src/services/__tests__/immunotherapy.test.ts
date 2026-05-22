import { describe, expect, it, vi } from "vitest";

// computeQuote / createImmunotherapyBudget leen db.immunotherapyProduct,
// db.clinicalAllergen, db.patient, db.budget. Mockeamos @finanzas/db (+ slices
// por la regla del repo). Las columnas Decimal se emulan con un wrapper que
// expone toString() (lo que el service consume vía new Decimal(x.toString())).

function dec(n: number) {
  return { toString: () => String(n) };
}

const { mockDb, mockProductFindUnique, mockAllergenFindMany, mockPatientFindUnique, mockBudgetCreate } =
  vi.hoisted(() => {
    const mockProductFindUnique = vi.fn();
    const mockAllergenFindMany = vi.fn();
    const mockPatientFindUnique = vi.fn();
    const mockBudgetCreate = vi.fn();
    const mockDb = {
      immunotherapyProduct: {
        findUnique: (...a: unknown[]) => mockProductFindUnique(...a),
      },
      clinicalAllergen: { findMany: (...a: unknown[]) => mockAllergenFindMany(...a) },
      patient: { findUnique: (...a: unknown[]) => mockPatientFindUnique(...a) },
      budget: { create: (...a: unknown[]) => mockBudgetCreate(...a) },
    };
    return {
      mockDb,
      mockProductFindUnique,
      mockAllergenFindMany,
      mockPatientFindUnique,
      mockBudgetCreate,
    };
  });

vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { computeQuote, createImmunotherapyBudget } = await import("../immunotherapy.ts");

// Producto ejemplo (estructura del LaTeX): inicio escalonado + mantención.
function clustoid() {
  return {
    id: 1,
    name: "Clustoid",
    lab: "Roxall",
    vaccineProduct: "CLUSTOID",
    concentrationUtMl: 10000,
    perAllergen: false,
    maxAllergens: null,
    maintenanceTargetMl: dec(0.5),
    maintenanceStepMl: dec(0.25),
    maintenanceDefaultQty: 11,
    defaultDiscountPct: dec(10),
    isActive: true,
    sortOrder: 0,
    stages: [
      { id: 10, productId: 1, label: "Primera dosis", unitPrice: dec(40000), defaultQty: 1, isMaintenance: false, sortOrder: 0 },
      { id: 11, productId: 1, label: "Segunda dosis", unitPrice: dec(60000), defaultQty: 1, isMaintenance: false, sortOrder: 1 },
      { id: 12, productId: 1, label: "Tercera dosis", unitPrice: dec(80000), defaultQty: 1, isMaintenance: false, sortOrder: 2 },
      { id: 13, productId: 1, label: "Cuarta dosis", unitPrice: dec(100000), defaultQty: 1, isMaintenance: false, sortOrder: 3 },
      { id: 14, productId: 1, label: "Dosis mantención", unitPrice: dec(120000), defaultQty: 11, isMaintenance: true, sortOrder: 4 },
    ],
  };
}

describe("computeQuote", () => {
  it("replica el presupuesto del LaTeX: subtotal 1.600.000, -10% = 1.440.000", async () => {
    mockProductFindUnique.mockResolvedValue(clustoid());
    mockAllergenFindMany.mockResolvedValue([]);

    const quote = await computeQuote({ productId: 1 });

    expect(quote.subtotal).toBe(1_600_000);
    expect(quote.discountPct).toBe(10);
    expect(quote.discountAmount).toBe(160_000);
    expect(quote.total).toBe(1_440_000);
    // 4 etapas inicio + 1 mantención
    expect(quote.lines).toHaveLength(5);
    const maint = quote.lines.find((l) => l.isMaintenance);
    expect(maint?.quantity).toBe(11);
    expect(maint?.subtotal).toBe(1_320_000);
  });

  it("ajusta la mantención proporcional al volumen (0,75 mL = ×1,5)", async () => {
    mockProductFindUnique.mockResolvedValue(clustoid());
    mockAllergenFindMany.mockResolvedValue([]);

    const quote = await computeQuote({ productId: 1, maintenanceMl: 0.75, discountPct: 0 });

    const maint = quote.lines.find((l) => l.isMaintenance);
    expect(maint?.unitPrice).toBe(180_000); // 120.000 × (0,75 / 0,5)
    expect(quote.maintenanceMl).toBe(0.75);
  });

  it("respeta override de cantidad de mantención y descuento", async () => {
    mockProductFindUnique.mockResolvedValue(clustoid());
    mockAllergenFindMany.mockResolvedValue([]);

    const quote = await computeQuote({ productId: 1, maintenanceQty: 5, discountPct: 0 });

    const maint = quote.lines.find((l) => l.isMaintenance);
    expect(maint?.quantity).toBe(5);
    // inicio 40+60+80+100k = 280k + 5×120k = 600k → 880k
    expect(quote.subtotal).toBe(880_000);
    expect(quote.total).toBe(880_000);
  });

  it("rechaza más alérgenos que maxAllergens (Forte = 1)", async () => {
    mockProductFindUnique.mockResolvedValue({ ...clustoid(), name: "Clustek Forte", maxAllergens: 1 });
    mockAllergenFindMany.mockResolvedValue([]);
    await expect(
      computeQuote({ productId: 1, allergenIds: ["a", "b"] })
    ).rejects.toMatchObject({ kind: "BAD_REQUEST" });
  });

  it("lanza NOT_FOUND si el producto no existe", async () => {
    mockProductFindUnique.mockResolvedValue(null);
    await expect(computeQuote({ productId: 99 })).rejects.toMatchObject({ kind: "NOT_FOUND" });
  });
});

describe("createImmunotherapyBudget", () => {
  it("persiste Budget con montos y desglose en notes", async () => {
    mockProductFindUnique.mockResolvedValue(clustoid());
    mockAllergenFindMany.mockResolvedValue([]);
    mockPatientFindUnique.mockResolvedValue({ id: 7 });
    mockBudgetCreate.mockResolvedValue({ id: 123 });

    const res = await createImmunotherapyBudget({ productId: 1, patientId: 7 });

    expect(res.budgetId).toBe(123);
    expect(res.quote.total).toBe(1_440_000);
    const arg = mockBudgetCreate.mock.calls[0][0] as { data: { notes: string; patientId: number } };
    expect(arg.data.patientId).toBe(7);
    expect(JSON.parse(arg.data.notes)).toMatchObject({ kind: "immunotherapy", productId: 1 });
  });

  it("lanza NOT_FOUND si el paciente no existe", async () => {
    mockPatientFindUnique.mockResolvedValue(null);
    await expect(
      createImmunotherapyBudget({ productId: 1, patientId: 999 })
    ).rejects.toMatchObject({ kind: "NOT_FOUND" });
  });
});
