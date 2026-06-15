import { beforeEach, describe, expect, it, vi } from "vitest";

// computeQuote / createImmunotherapyBudget leen db.immunotherapyProduct,
// db.clinicalAllergen, db.patient, db.budget. Mockeamos @finanzas/db (+ slices
// por la regla del repo). Las columnas Decimal se emulan con un wrapper que
// expone toString() (lo que el service consume vía new Decimal(x.toString())).

function dec(n: number) {
  return { toString: () => String(n) };
}

const {
  mockDb,
  mockProductFindUnique,
  mockProductFindMany,
  mockProductCreate,
  mockProductUpdate,
  mockProductDelete,
  mockStageDeleteMany,
  mockAllergenFindMany,
  mockPatientFindUnique,
  mockBudgetCreate,
  mockClinicUpsert,
} = vi.hoisted(() => {
  const mockProductFindUnique = vi.fn();
  const mockProductFindMany = vi.fn();
  const mockProductCreate = vi.fn();
  const mockProductUpdate = vi.fn();
  const mockProductDelete = vi.fn();
  const mockStageDeleteMany = vi.fn();
  const mockAllergenFindMany = vi.fn();
  const mockPatientFindUnique = vi.fn();
  const mockBudgetCreate = vi.fn();
  const mockClinicUpsert = vi.fn();
  const mockDb = {
    immunotherapyProduct: {
      findUnique: (...a: unknown[]) => mockProductFindUnique(...a),
      findMany: (...a: unknown[]) => mockProductFindMany(...a),
      create: (...a: unknown[]) => mockProductCreate(...a),
      update: (...a: unknown[]) => mockProductUpdate(...a),
      delete: (...a: unknown[]) => mockProductDelete(...a),
    },
    immunotherapyDoseStage: {
      deleteMany: (...a: unknown[]) => mockStageDeleteMany(...a),
    },
    clinicalAllergen: { findMany: (...a: unknown[]) => mockAllergenFindMany(...a) },
    patient: { findUnique: (...a: unknown[]) => mockPatientFindUnique(...a) },
    budget: { create: (...a: unknown[]) => mockBudgetCreate(...a) },
    clinicSettings: { upsert: (...a: unknown[]) => mockClinicUpsert(...a) },
  };
  return {
    mockDb,
    mockProductFindUnique,
    mockProductFindMany,
    mockProductCreate,
    mockProductUpdate,
    mockProductDelete,
    mockStageDeleteMany,
    mockAllergenFindMany,
    mockPatientFindUnique,
    mockBudgetCreate,
    mockClinicUpsert,
  };
});

// PDF generators are lazy-imported inside the service; stub them so the PDF
// functions exercise their assembly/interpolation/filename logic without
// loading pdf-lib or shelling out to Ghostscript.
const { mockGenerateBudgetPdf, mockGeneratePrescriptionPdf, mockToPdfA3 } = vi.hoisted(() => ({
  mockGenerateBudgetPdf: vi.fn(),
  mockGeneratePrescriptionPdf: vi.fn(),
  mockToPdfA3: vi.fn(),
}));

vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));
vi.mock("../../modules/immunotherapy/budget-pdf.service.ts", () => ({
  generateBudgetPdf: (...a: unknown[]) => mockGenerateBudgetPdf(...a),
}));
vi.mock("../../modules/immunotherapy/prescription-pdf.service.ts", () => ({
  generatePrescriptionPdf: (...a: unknown[]) => mockGeneratePrescriptionPdf(...a),
}));
vi.mock("../../modules/pdf/pdf-a.ts", () => ({
  toPdfA3: (...a: unknown[]) => mockToPdfA3(...a),
}));

const { DomainError } = await import("../../lib/errors.ts");
const {
  computeQuote,
  createImmunotherapyBudget,
  updateProduct,
  listProducts,
  createProduct,
  deleteProduct,
  listAllergens,
  getTerms,
  updateTerms,
  generateBudgetPdfFile,
  generatePrescriptionPdfFile,
} = await import("../immunotherapy.ts");

type CreateProductArg = Parameters<typeof createProduct>[0];
type UpdateProductArg = Parameters<typeof updateProduct>[0];

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
      {
        id: 10,
        productId: 1,
        label: "Primera dosis",
        unitPrice: dec(40000),
        defaultQty: 1,
        isMaintenance: false,
        sortOrder: 0,
      },
      {
        id: 11,
        productId: 1,
        label: "Segunda dosis",
        unitPrice: dec(60000),
        defaultQty: 1,
        isMaintenance: false,
        sortOrder: 1,
      },
      {
        id: 12,
        productId: 1,
        label: "Tercera dosis",
        unitPrice: dec(80000),
        defaultQty: 1,
        isMaintenance: false,
        sortOrder: 2,
      },
      {
        id: 13,
        productId: 1,
        label: "Cuarta dosis",
        unitPrice: dec(100000),
        defaultQty: 1,
        isMaintenance: false,
        sortOrder: 3,
      },
      {
        id: 14,
        productId: 1,
        label: "Dosis mantención",
        unitPrice: dec(120000),
        defaultQty: 11,
        isMaintenance: true,
        sortOrder: 4,
      },
    ],
  };
}

beforeEach(() => {
  for (const m of [
    mockProductFindUnique,
    mockProductFindMany,
    mockProductCreate,
    mockProductUpdate,
    mockProductDelete,
    mockStageDeleteMany,
    mockAllergenFindMany,
    mockPatientFindUnique,
    mockBudgetCreate,
    mockClinicUpsert,
    mockGenerateBudgetPdf,
    mockGeneratePrescriptionPdf,
    mockToPdfA3,
  ]) {
    m.mockReset();
  }
});

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
    mockProductFindUnique.mockResolvedValue({
      ...clustoid(),
      name: "Clustek Forte",
      maxAllergens: 1,
    });
    mockAllergenFindMany.mockResolvedValue([]);
    await expect(computeQuote({ productId: 1, allergenIds: ["a", "b"] })).rejects.toMatchObject({
      kind: "BAD_REQUEST",
    });
  });

  it("lanza NOT_FOUND con mensaje exacto si el producto no existe", async () => {
    mockProductFindUnique.mockResolvedValue(null);
    await expect(computeQuote({ productId: 99 })).rejects.toMatchObject({
      kind: "NOT_FOUND",
      message: "Producto de inmunoterapia no encontrado",
    });
  });

  it("rechaza un producto sin etapas configuradas", async () => {
    mockProductFindUnique.mockResolvedValue({ ...clustoid(), stages: [] });
    await expect(computeQuote({ productId: 1 })).rejects.toMatchObject({
      kind: "BAD_REQUEST",
      message: "El producto no tiene etapas de dosis configuradas",
    });
  });

  it("rechaza más alérgenos que maxAllergens con mensaje exacto interpolado", async () => {
    mockProductFindUnique.mockResolvedValue({
      ...clustoid(),
      name: "Clustek Forte",
      maxAllergens: 1,
    });
    mockAllergenFindMany.mockResolvedValue([]);
    await expect(
      computeQuote({ productId: 1, allergenIds: ["a", "b", "c"] })
    ).rejects.toMatchObject({
      kind: "BAD_REQUEST",
      message: "Clustek Forte admite máximo 1 alérgeno(s); seleccionaste 3.",
    });
  });

  it("no aplica límite de alérgenos cuando maxAllergens es null", async () => {
    mockProductFindUnique.mockResolvedValue(clustoid()); // maxAllergens: null
    mockAllergenFindMany.mockResolvedValue([]);
    await expect(
      computeQuote({ productId: 1, allergenIds: ["a", "b", "c", "d"] })
    ).resolves.toBeDefined();
  });

  it("permite exactamente maxAllergens alérgenos (límite es >, no >=)", async () => {
    mockProductFindUnique.mockResolvedValue({ ...clustoid(), maxAllergens: 1 });
    mockAllergenFindMany.mockResolvedValue([]);
    await expect(computeQuote({ productId: 1, allergenIds: ["a"] })).resolves.toBeDefined();
  });

  it("rechaza maintenanceMl <= 0", async () => {
    mockProductFindUnique.mockResolvedValue(clustoid());
    mockAllergenFindMany.mockResolvedValue([]);
    await expect(computeQuote({ productId: 1, maintenanceMl: 0 })).rejects.toMatchObject({
      kind: "BAD_REQUEST",
      message: "El volumen de mantención debe ser mayor a 0",
    });
  });

  it("trata defaultDiscountPct null como 0% (sin descuento)", async () => {
    mockProductFindUnique.mockResolvedValue({ ...clustoid(), defaultDiscountPct: null });
    mockAllergenFindMany.mockResolvedValue([]);
    const quote = await computeQuote({ productId: 1 });
    expect(quote.discountPct).toBe(0);
    expect(quote.discountAmount).toBe(0);
    expect(quote.total).toBe(quote.subtotal);
  });

  it("aplica override de unitPrice por etapa", async () => {
    mockProductFindUnique.mockResolvedValue(clustoid());
    mockAllergenFindMany.mockResolvedValue([]);
    const quote = await computeQuote({
      productId: 1,
      discountPct: 0,
      stageOverrides: [{ stageId: 10, unitPrice: 99_999 }],
    });
    const first = quote.lines.find((l) => l.stageId === 10);
    expect(first?.unitPrice).toBe(99_999);
  });

  it("preserva el orden de selección de alérgenos (no el de la DB)", async () => {
    mockProductFindUnique.mockResolvedValue(clustoid());
    // findMany devuelve a,b; el usuario seleccionó b,a → debe respetar b,a.
    mockAllergenFindMany.mockResolvedValue([
      { id: "a", commonName: "Ácaro", scientificName: null },
      { id: "b", commonName: "Polen", scientificName: null },
    ]);
    const quote = await computeQuote({ productId: 1, allergenIds: ["b", "a"] });
    expect(quote.allergens.map((x) => x.id)).toEqual(["b", "a"]);
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

  it("lanza NOT_FOUND con mensaje exacto si el paciente no existe y NO crea Budget", async () => {
    mockBudgetCreate.mockClear();
    mockPatientFindUnique.mockResolvedValue(null);
    await expect(createImmunotherapyBudget({ productId: 1, patientId: 999 })).rejects.toMatchObject(
      { kind: "NOT_FOUND", message: "Paciente no encontrado" }
    );
    expect(mockBudgetCreate).not.toHaveBeenCalled();
  });

  it("genera título por defecto y respeta el título explícito", async () => {
    mockProductFindUnique.mockResolvedValue(clustoid());
    mockAllergenFindMany.mockResolvedValue([]);
    mockPatientFindUnique.mockResolvedValue({ id: 7 });
    mockBudgetCreate.mockResolvedValue({ id: 1 });

    await createImmunotherapyBudget({ productId: 1, patientId: 7 });
    const def = mockBudgetCreate.mock.calls[0][0] as { data: { title: string } };
    expect(def.data.title).toBe("Inmunoterapia Clustoid (anual)");

    mockBudgetCreate.mockClear();
    await createImmunotherapyBudget({ productId: 1, patientId: 7, title: "Plan personalizado" });
    const custom = mockBudgetCreate.mock.calls[0][0] as { data: { title: string } };
    expect(custom.data.title).toBe("Plan personalizado");
  });
});

describe("computeQuote — db args, passthrough, fallbacks", () => {
  it("consulta el producto por id con las etapas ordenadas asc", async () => {
    mockProductFindUnique.mockResolvedValue(clustoid());
    mockAllergenFindMany.mockResolvedValue([]);
    await computeQuote({ productId: 1 });
    expect(mockProductFindUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: { stages: { orderBy: { sortOrder: "asc" } } },
    });
  });

  it("propaga concentrationUtMl / perAllergen / hiddenSections sin alterar", async () => {
    mockProductFindUnique.mockResolvedValue({ ...clustoid(), perAllergen: true });
    mockAllergenFindMany.mockResolvedValue([]);
    const quote = await computeQuote({
      productId: 1,
      hiddenSections: ["lab", "prices"],
    });
    expect(quote.productId).toBe(1);
    expect(quote.productName).toBe("Clustoid");
    expect(quote.concentrationUtMl).toBe(10000);
    expect(quote.perAllergen).toBe(true);
    expect(quote.hiddenSections).toEqual(["lab", "prices"]);
  });

  it("hiddenSections por defecto es [] cuando se omite", async () => {
    mockProductFindUnique.mockResolvedValue(clustoid());
    mockAllergenFindMany.mockResolvedValue([]);
    const quote = await computeQuote({ productId: 1 });
    expect(quote.hiddenSections).toEqual([]);
  });

  it("usa maintenanceTargetMl del producto cuando no se pasa maintenanceMl", async () => {
    mockProductFindUnique.mockResolvedValue(clustoid());
    mockAllergenFindMany.mockResolvedValue([]);
    const quote = await computeQuote({ productId: 1, discountPct: 0 });
    expect(quote.maintenanceMl).toBe(0.5); // target del producto
    const maint = quote.lines.find((l) => l.isMaintenance);
    expect(maint?.unitPrice).toBe(120_000); // 120k × (0.5/0.5)
  });

  it("la cantidad de mantención cae al maintenanceDefaultQty del producto", async () => {
    // sin maintenanceQty ni override → product.maintenanceDefaultQty = 11
    mockProductFindUnique.mockResolvedValue({ ...clustoid(), maintenanceDefaultQty: 7 });
    mockAllergenFindMany.mockResolvedValue([]);
    const quote = await computeQuote({ productId: 1, discountPct: 0 });
    const maint = quote.lines.find((l) => l.isMaintenance);
    expect(maint?.quantity).toBe(7);
  });

  it("override.qty tiene prioridad sobre maintenanceQty para la etapa de mantención", async () => {
    mockProductFindUnique.mockResolvedValue(clustoid());
    mockAllergenFindMany.mockResolvedValue([]);
    const quote = await computeQuote({
      productId: 1,
      discountPct: 0,
      maintenanceQty: 5,
      stageOverrides: [{ stageId: 14, qty: 3 }],
    });
    const maint = quote.lines.find((l) => l.isMaintenance);
    expect(maint?.quantity).toBe(3); // override gana, no el 5 ni el default 11
  });

  it("override.qty en una etapa de inicio reemplaza su defaultQty", async () => {
    mockProductFindUnique.mockResolvedValue(clustoid());
    mockAllergenFindMany.mockResolvedValue([]);
    const quote = await computeQuote({
      productId: 1,
      discountPct: 0,
      stageOverrides: [{ stageId: 10, qty: 4 }],
    });
    const first = quote.lines.find((l) => l.stageId === 10);
    expect(first?.quantity).toBe(4);
    expect(first?.subtotal).toBe(160_000); // 40k × 4
  });

  it("no llama clinicalAllergen.findMany cuando no hay allergenIds (short-circuit)", async () => {
    mockProductFindUnique.mockResolvedValue(clustoid());
    const quote = await computeQuote({ productId: 1 });
    expect(quote.allergens).toEqual([]);
    expect(mockAllergenFindMany).not.toHaveBeenCalled();
  });

  it("carga los alérgenos por id (in) con select acotado y descarta ids inexistentes", async () => {
    mockProductFindUnique.mockResolvedValue(clustoid());
    mockAllergenFindMany.mockResolvedValue([
      { id: "a", commonName: "Ácaro", scientificName: "D. pteronyssinus" },
    ]);
    const quote = await computeQuote({ productId: 1, allergenIds: ["a", "ghost"] });
    expect(mockAllergenFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["a", "ghost"] } },
      select: { id: true, commonName: true, scientificName: true },
    });
    // "ghost" no vino en el findMany → filtrado fuera.
    expect(quote.allergens.map((x) => x.id)).toEqual(["a"]);
  });

  it("la mantención proporcional redondea CLP half-up por línea", async () => {
    // baseUnit 100 × (0.3333.../0.5) requiere redondeo entero.
    mockProductFindUnique.mockResolvedValue({
      ...clustoid(),
      stages: [
        {
          id: 14,
          productId: 1,
          label: "M",
          unitPrice: dec(100),
          defaultQty: 1,
          isMaintenance: true,
          sortOrder: 0,
        },
      ],
    });
    mockAllergenFindMany.mockResolvedValue([]);
    const quote = await computeQuote({ productId: 1, maintenanceMl: 0.333, discountPct: 0 });
    // 100 × 0.333 / 0.5 = 66.6 → 67
    expect(quote.lines[0].unitPrice).toBe(67);
  });
});

describe("createImmunotherapyBudget — persistencia exacta", () => {
  it("escribe totalAmount/discount/finalAmount como Decimal y notes JSON con el desglose", async () => {
    mockProductFindUnique.mockResolvedValue(clustoid());
    mockAllergenFindMany.mockResolvedValue([]);
    mockPatientFindUnique.mockResolvedValue({ id: 7 });
    mockBudgetCreate.mockResolvedValue({ id: 55 });

    const res = await createImmunotherapyBudget({ productId: 1, patientId: 7 });
    expect(res.budgetId).toBe(55);

    expect(mockPatientFindUnique).toHaveBeenCalledWith({ where: { id: 7 } });
    const arg = mockBudgetCreate.mock.calls[0][0] as {
      data: {
        patientId: number;
        totalAmount: { toString: () => string };
        discount: { toString: () => string };
        finalAmount: { toString: () => string };
        notes: string;
      };
      select: { id: true };
    };
    expect(arg.select).toEqual({ id: true });
    expect(arg.data.patientId).toBe(7);
    // subtotal 1.600.000, descuento 160.000, total 1.440.000
    expect(arg.data.totalAmount.toString()).toBe("1600000");
    expect(arg.data.discount.toString()).toBe("160000");
    expect(arg.data.finalAmount.toString()).toBe("1440000");

    const notes = JSON.parse(arg.data.notes) as {
      kind: string;
      productId: number;
      productName: string;
      maintenanceMl: number;
      discountPct: number;
      lines: unknown[];
      allergens: unknown[];
      hiddenSections: unknown[];
    };
    expect(notes.kind).toBe("immunotherapy");
    expect(notes.productId).toBe(1);
    expect(notes.productName).toBe("Clustoid");
    expect(notes.maintenanceMl).toBe(0.5);
    expect(notes.discountPct).toBe(10);
    expect(notes.lines).toHaveLength(5);
    expect(notes.allergens).toEqual([]);
    expect(notes.hiddenSections).toEqual([]);
  });
});

describe("listProducts", () => {
  it("incluye etapas ordenadas y ordena por sortOrder luego name; serializa Decimals", async () => {
    mockProductFindMany.mockResolvedValue([clustoid()]);
    const r = await listProducts();
    expect(mockProductFindMany).toHaveBeenCalledWith({
      include: { stages: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    expect(r).toHaveLength(1);
    const p = r[0];
    expect(p.id).toBe(1);
    expect(p.name).toBe("Clustoid");
    expect(p.lab).toBe("Roxall");
    expect(p.maintenanceTargetMl).toBe(0.5);
    expect(p.maintenanceStepMl).toBe(0.25);
    expect(p.defaultDiscountPct).toBe(10);
    expect(p.stages).toHaveLength(5);
    expect(p.stages[0].unitPrice).toBe(40000);
  });

  it("num() devuelve null para Decimals nulos y default 0 para campos requeridos", async () => {
    mockProductFindMany.mockResolvedValue([
      {
        ...clustoid(),
        defaultDiscountPct: null,
        maintenanceTargetMl: null,
        maintenanceStepMl: null,
      },
    ]);
    const r = await listProducts();
    expect(r[0].defaultDiscountPct).toBeNull(); // nullable → null
    expect(r[0].maintenanceTargetMl).toBe(0); // requerido → ?? 0
    expect(r[0].maintenanceStepMl).toBe(0);
  });
});

describe("createProduct", () => {
  function input(over: Partial<CreateProductArg> = {}): CreateProductArg {
    return {
      name: "Nuevo",
      perAllergen: false,
      maintenanceTargetMl: 0.5,
      maintenanceStepMl: 0.25,
      maintenanceDefaultQty: 11,
      isActive: true,
      sortOrder: 0,
      stages: [
        { label: "D1", unitPrice: 1000, defaultQty: 1, isMaintenance: false, sortOrder: 0 },
        { label: "M", unitPrice: 2000, defaultQty: 11, isMaintenance: true, sortOrder: 1 },
      ],
      ...over,
    } as CreateProductArg;
  }

  it("aplica ?? null a campos opcionales ausentes y crea las etapas", async () => {
    mockProductCreate.mockResolvedValue(clustoid());
    await createProduct(input());
    const arg = mockProductCreate.mock.calls[0][0] as {
      data: Record<string, unknown> & { stages: { create: Record<string, unknown>[] } };
      include: unknown;
    };
    expect(arg.data.name).toBe("Nuevo");
    expect(arg.data.lab).toBeNull();
    expect(arg.data.vaccineProduct).toBeNull();
    expect(arg.data.concentrationUtMl).toBeNull();
    expect(arg.data.maxAllergens).toBeNull();
    expect(arg.data.defaultDiscountPct).toBeNull();
    expect(arg.data.perAllergen).toBe(false);
    expect(arg.data.isActive).toBe(true);
    expect(arg.data.maintenanceTargetMl).toBe(0.5);
    expect(arg.data.stages.create).toHaveLength(2);
    expect(arg.data.stages.create[0]).toEqual({
      label: "D1",
      unitPrice: 1000,
      defaultQty: 1,
      isMaintenance: false,
      sortOrder: 0,
    });
    expect(arg.include).toEqual({ stages: { orderBy: { sortOrder: "asc" } } });
  });

  it("pasa los valores opcionales provistos sin colapsar a null", async () => {
    mockProductCreate.mockResolvedValue(clustoid());
    await createProduct(
      input({
        lab: "Roxall",
        vaccineProduct: "CLUSTOID",
        concentrationUtMl: 10000,
        maxAllergens: 3,
        defaultDiscountPct: 15,
      })
    );
    const arg = mockProductCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.lab).toBe("Roxall");
    expect(arg.data.vaccineProduct).toBe("CLUSTOID");
    expect(arg.data.concentrationUtMl).toBe(10000);
    expect(arg.data.maxAllergens).toBe(3);
    expect(arg.data.defaultDiscountPct).toBe(15);
  });

  it("usa el índice como sortOrder cuando la etapa no lo trae (?? i)", async () => {
    mockProductCreate.mockResolvedValue(clustoid());
    await createProduct(
      input({
        stages: [
          { label: "A", unitPrice: 1, defaultQty: 1, isMaintenance: false },
          { label: "B", unitPrice: 2, defaultQty: 1, isMaintenance: false },
        ] as CreateProductArg["stages"],
      })
    );
    const arg = mockProductCreate.mock.calls[0][0] as {
      data: { stages: { create: { sortOrder: number }[] } };
    };
    expect(arg.data.stages.create[0].sortOrder).toBe(0);
    expect(arg.data.stages.create[1].sortOrder).toBe(1);
  });
});

describe("updateProduct — cuerpo completo", () => {
  it("lanza NOT_FOUND 'Producto no encontrado' si el producto a actualizar no existe", async () => {
    mockProductFindUnique.mockResolvedValue(null);
    try {
      await updateProduct({ id: 404, name: "x" } as UpdateProductArg);
      throw new Error("no lanzó");
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).kind).toBe("NOT_FOUND");
      // Distinto del mensaje de computeQuote ("...de inmunoterapia no encontrado").
      expect((err as DomainError).message).toBe("Producto no encontrado");
    }
    expect(mockProductUpdate).not.toHaveBeenCalled();
  });

  it("filtra claves undefined del payload y NO toca etapas si stages es undefined", async () => {
    mockProductFindUnique.mockResolvedValue(clustoid());
    mockProductUpdate.mockResolvedValue(clustoid());
    await updateProduct({ id: 1, name: "Renombrado" } as UpdateProductArg);
    expect(mockStageDeleteMany).not.toHaveBeenCalled();
    const arg = mockProductUpdate.mock.calls[0][0] as {
      where: { id: number };
      data: Record<string, unknown>;
      include: unknown;
    };
    expect(arg.where).toEqual({ id: 1 });
    expect(arg.data).toEqual({ name: "Renombrado" }); // id y undefined excluidos
    expect("id" in arg.data).toBe(false);
    expect(arg.include).toEqual({ stages: { orderBy: { sortOrder: "asc" } } });
  });

  it("reemplaza todas las etapas (deleteMany por productId + recrea) cuando stages viene", async () => {
    mockProductFindUnique.mockResolvedValue(clustoid());
    mockStageDeleteMany.mockResolvedValue({ count: 5 });
    mockProductUpdate.mockResolvedValue(clustoid());
    await updateProduct({
      id: 3,
      stages: [{ label: "X", unitPrice: 500, defaultQty: 1, isMaintenance: false }],
    } as UpdateProductArg);
    expect(mockStageDeleteMany).toHaveBeenCalledWith({ where: { productId: 3 } });
    const arg = mockProductUpdate.mock.calls[0][0] as {
      data: { stages: { create: { label: string; sortOrder: number }[] } };
    };
    expect(arg.data.stages.create[0].label).toBe("X");
    expect(arg.data.stages.create[0].sortOrder).toBe(0); // ?? i
  });
});

describe("deleteProduct", () => {
  it("borra por id", async () => {
    mockProductDelete.mockResolvedValue(undefined);
    await deleteProduct(8);
    expect(mockProductDelete).toHaveBeenCalledWith({ where: { id: 8 } });
  });
});

describe("listAllergens", () => {
  it("sin q: where solo isActive, orden por commonName asc, take 500", async () => {
    mockAllergenFindMany.mockResolvedValue([]);
    await listAllergens();
    expect(mockAllergenFindMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, commonName: true, scientificName: true },
      orderBy: { commonName: "asc" },
      take: 500,
    });
  });

  it("con q: agrega OR contains insensitive sobre commonName/scientificName", async () => {
    mockAllergenFindMany.mockResolvedValue([]);
    await listAllergens("  pol  ");
    const arg = mockAllergenFindMany.mock.calls[0][0] as {
      where: { isActive: boolean; OR: unknown[] };
    };
    expect(arg.where.isActive).toBe(true);
    expect(arg.where.OR).toEqual([
      { commonName: { contains: "pol", mode: "insensitive" } },
      { scientificName: { contains: "pol", mode: "insensitive" } },
    ]);
  });

  it("q en blanco (solo espacios) se trata como sin filtro", async () => {
    mockAllergenFindMany.mockResolvedValue([]);
    await listAllergens("   ");
    const arg = mockAllergenFindMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where).toEqual({ isActive: true });
    expect("OR" in arg.where).toBe(false);
  });
});

describe("getTerms", () => {
  it("upsert del singleton id=1 (sin update) y mapea los 4 campos", async () => {
    mockClinicUpsert.mockResolvedValue({
      legalName: "Bioalergia SpA",
      legalRut: "76.1-2",
      immunoBudgetTerms: "términos",
      immunoBudgetIntro: "intro",
    });
    const r = await getTerms();
    expect(mockClinicUpsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
    expect(r).toEqual({
      legalName: "Bioalergia SpA",
      legalRut: "76.1-2",
      immunoBudgetTerms: "términos",
      immunoBudgetIntro: "intro",
    });
  });
});

describe("updateTerms", () => {
  it("filtra undefined del input y upsert update+create con esos datos", async () => {
    mockClinicUpsert.mockResolvedValue({
      legalName: "X",
      legalRut: null,
      immunoBudgetTerms: null,
      immunoBudgetIntro: null,
    });
    await updateTerms({ legalName: "X", immunoBudgetTerms: undefined });
    expect(mockClinicUpsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: { legalName: "X" }, // immunoBudgetTerms undefined excluido
      create: { id: 1, legalName: "X" },
    });
  });

  it("permite setear un campo a null explícito (null no es undefined)", async () => {
    mockClinicUpsert.mockResolvedValue({
      legalName: null,
      legalRut: null,
      immunoBudgetTerms: null,
      immunoBudgetIntro: null,
    });
    await updateTerms({ legalName: null });
    const arg = mockClinicUpsert.mock.calls[0][0] as { update: Record<string, unknown> };
    expect(arg.update).toEqual({ legalName: null });
  });
});

describe("generateBudgetPdfFile", () => {
  function patientRow(over: Record<string, unknown> = {}) {
    return {
      person: {
        names: "Juan",
        fatherName: "Pérez",
        motherName: "Soto",
        rut: "12.345.678-9",
        ...over,
      },
    };
  }
  function clinicRow() {
    return {
      name: "Bioalergia",
      legalName: "Bioalergia SpA",
      legalRut: "76.1-2",
      address: "Dir 1",
      phoneWhatsapp: "+569",
      phoneLandline: "412",
      email: "a@b.cl",
      doctorName: "Dr. X",
      doctorRut: "1-9",
      logoUrl: null,
      immunoBudgetTerms: "TERMS",
      immunoBudgetIntro: "Hola {{paciente}}, apoderado {{apoderado}}, dx {{diagnostico}}.",
    };
  }

  it("lanza NOT_FOUND si el paciente no existe y no genera PDF", async () => {
    mockPatientFindUnique.mockResolvedValue(null);
    await expect(generateBudgetPdfFile({ productId: 1, patientId: 9 })).rejects.toMatchObject({
      kind: "NOT_FOUND",
      message: "Paciente no encontrado",
    });
    expect(mockGenerateBudgetPdf).not.toHaveBeenCalled();
  });

  it("ensambla nombre, interpola intro, arma filename sin puntos y pasa lab/terms", async () => {
    mockPatientFindUnique.mockResolvedValue(patientRow());
    mockProductFindUnique
      .mockResolvedValueOnce(clustoid()) // computeQuote
      .mockResolvedValueOnce({ lab: "Roxall" }); // product lab lookup
    mockAllergenFindMany.mockResolvedValue([]);
    mockClinicUpsert.mockResolvedValue(clinicRow());
    mockGenerateBudgetPdf.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockToPdfA3.mockResolvedValue(new Uint8Array([9, 9]));

    const r = await generateBudgetPdfFile({
      productId: 1,
      patientId: 7,
      parentName: " María ",
      diagnosis: " rinitis ",
    });

    expect(r.fileName).toBe("presupuesto_inmunoterapia_12345678-9.pdf");
    expect(r.pdfBytes).toEqual(new Uint8Array([9, 9]));
    expect(mockToPdfA3).toHaveBeenCalledWith(
      new Uint8Array([1, 2, 3]),
      "Presupuesto de inmunoterapia"
    );
    const arg = mockGenerateBudgetPdf.mock.calls[0][0] as {
      patient: { name: string; rut: string };
      lab: string | null;
      terms: string | null;
      intro: string | null;
    };
    expect(arg.patient.name).toBe("Juan Pérez Soto");
    expect(arg.patient.rut).toBe("12.345.678-9");
    expect(arg.lab).toBe("Roxall");
    expect(arg.terms).toBe("TERMS");
    expect(arg.intro).toBe("Hola Juan Pérez Soto, apoderado María, dx rinitis.");
  });

  it("intro usa fallbacks 'apoderado/a' y 'su condición alérgica' cuando faltan datos", async () => {
    mockPatientFindUnique.mockResolvedValue(patientRow());
    mockProductFindUnique.mockResolvedValueOnce(clustoid()).mockResolvedValueOnce({ lab: null });
    mockAllergenFindMany.mockResolvedValue([]);
    mockClinicUpsert.mockResolvedValue(clinicRow());
    mockGenerateBudgetPdf.mockResolvedValue(new Uint8Array());
    mockToPdfA3.mockResolvedValue(new Uint8Array());

    await generateBudgetPdfFile({ productId: 1, patientId: 7 });
    const arg = mockGenerateBudgetPdf.mock.calls[0][0] as { intro: string | null; lab: null };
    expect(arg.intro).toBe(
      "Hola Juan Pérez Soto, apoderado apoderado/a, dx su condición alérgica."
    );
    expect(arg.lab).toBeNull();
  });

  it("intro es null cuando la clínica no tiene plantilla; filename usa 'sin_rut'", async () => {
    mockPatientFindUnique.mockResolvedValue(patientRow({ rut: null }));
    mockProductFindUnique.mockResolvedValueOnce(clustoid()).mockResolvedValueOnce({ lab: null });
    mockAllergenFindMany.mockResolvedValue([]);
    mockClinicUpsert.mockResolvedValue({ ...clinicRow(), immunoBudgetIntro: null });
    mockGenerateBudgetPdf.mockResolvedValue(new Uint8Array());
    mockToPdfA3.mockResolvedValue(new Uint8Array());

    const r = await generateBudgetPdfFile({ productId: 1, patientId: 7 });
    const arg = mockGenerateBudgetPdf.mock.calls[0][0] as { intro: string | null };
    expect(arg.intro).toBeNull();
    expect(r.fileName).toBe("presupuesto_inmunoterapia_sin_rut.pdf");
  });
});

describe("generatePrescriptionPdfFile", () => {
  function patientRow(over: Record<string, unknown> = {}) {
    return {
      birthDate: new Date("2000-01-01"),
      person: {
        names: "Ana",
        fatherName: "Díaz",
        motherName: null,
        rut: "9.876.543-2",
        email: "ana@x.cl",
        phone: "+569",
        ...over,
      },
    };
  }

  it("lanza NOT_FOUND si el paciente no existe", async () => {
    mockPatientFindUnique.mockResolvedValue(null);
    await expect(generatePrescriptionPdfFile({ productId: 1, patientId: 9 })).rejects.toMatchObject(
      { kind: "NOT_FOUND", message: "Paciente no encontrado" }
    );
  });

  it("lanza NOT_FOUND 'Producto no encontrado' cuando el lookup de producto es null", async () => {
    mockPatientFindUnique.mockResolvedValue(patientRow());
    // computeQuote (product ok) luego product lookup paralelo → null
    mockProductFindUnique.mockResolvedValueOnce(clustoid()).mockResolvedValueOnce(null);
    mockAllergenFindMany.mockResolvedValue([]);
    mockClinicUpsert.mockResolvedValue({ doctorName: "Dr", doctorRut: "1-9", email: "c@x.cl" });
    await expect(generatePrescriptionPdfFile({ productId: 1, patientId: 7 })).rejects.toMatchObject(
      { kind: "NOT_FOUND", message: "Producto no encontrado" }
    );
  });

  it("arma nombre (motherName null omitido), pasa diagnosis/observations y filename", async () => {
    mockPatientFindUnique.mockResolvedValue(patientRow());
    mockProductFindUnique
      .mockResolvedValueOnce(clustoid())
      .mockResolvedValueOnce({ name: "Clustoid", vaccineProduct: "CLUSTOID" });
    mockAllergenFindMany.mockResolvedValue([]);
    mockClinicUpsert.mockResolvedValue({ doctorName: "Dr", doctorRut: "1-9", email: "c@x.cl" });
    mockGeneratePrescriptionPdf.mockResolvedValue(new Uint8Array([4, 5]));
    mockToPdfA3.mockResolvedValue(new Uint8Array([7]));

    const r = await generatePrescriptionPdfFile({
      productId: 1,
      patientId: 7,
      diagnosis: "rinitis",
      observations: "ayunas",
    });

    expect(r.fileName).toBe("receta_inmunoterapia_9876543-2.pdf");
    expect(r.pdfBytes).toEqual(new Uint8Array([7]));
    expect(mockToPdfA3).toHaveBeenCalledWith(
      new Uint8Array([4, 5]),
      "Prescripción de inmunoterapia"
    );
    const arg = mockGeneratePrescriptionPdf.mock.calls[0][0] as {
      patient: { name: string; rut: string };
      product: { name: string };
      diagnosis?: string;
      observations?: string;
    };
    expect(arg.patient.name).toBe("Ana Díaz"); // motherName null filtrado
    expect(arg.patient.rut).toBe("9.876.543-2");
    expect(arg.product.name).toBe("Clustoid");
    expect(arg.diagnosis).toBe("rinitis");
    expect(arg.observations).toBe("ayunas");
  });
});
