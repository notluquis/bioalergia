import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError, type DomainErrorKind } from "../../lib/errors.ts";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    clinicalAllergen: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    clinicalAllergenAlias: {
      deleteMany: vi.fn(),
    },
  };
  return { mockDb };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { serializeAllergen, listAllergens, createAllergen, updateAllergen, deactivateAllergen } =
  await import("../clinical-allergens.ts");

// Same NFD + strip-accents + non-alnum→space + UPPERCASE rule as the service,
// so expected normalized values are computed, never hardcoded guesses.
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

async function expectDomainError(
  promise: Promise<unknown>,
  kind: DomainErrorKind,
  message: string
): Promise<void> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e
  );
  expect(err).toBeInstanceOf(DomainError);
  expect((err as DomainError).kind).toBe(kind);
  expect((err as DomainError).message).toBe(message);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.clinicalAllergen.findUnique.mockResolvedValue({ id: "alg_0001", aliases: [] });
  mockDb.clinicalAllergen.findMany.mockResolvedValue([]);
  mockDb.clinicalAllergen.create.mockImplementation(async ({ data }: { data: unknown }) => data);
  mockDb.clinicalAllergen.update.mockImplementation(async ({ data }: { data: unknown }) => data);
  mockDb.clinicalAllergenAlias.deleteMany.mockResolvedValue({ count: 0 });
});

const baseCreateInput = {
  scientificName: null,
  commonName: "Pasto bermuda / Chépica",
  englishName: null,
  category: "Gramíneas",
  categoryEn: null,
  pollenType: null,
  pollenTypeEn: null,
  tags: ["Polen", "GRAMINEA"],
  isActive: true,
  aliases: [{ alias: "Chépica", aliasType: "common" }],
};

describe("createAllergen", () => {
  it("derives the next alg_NNNN id from the current max, normalizes, lowercases tags, nests aliases", async () => {
    mockDb.clinicalAllergen.findMany.mockResolvedValue([{ id: "alg_0238" }]);
    await createAllergen(baseCreateInput as never);

    const arg = mockDb.clinicalAllergen.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data.id).toBe("alg_0239");
    expect(arg.data.commonName).toBe("Pasto bermuda / Chépica");
    expect(arg.data.normalizedCommonName).toBe(normalize("Pasto bermuda / Chépica"));
    expect(arg.data.tags).toEqual(["polen", "graminea"]);
    expect(arg.data.source).toBe("manual");

    const aliases = arg.data.aliases as { create: Record<string, unknown>[] };
    expect(aliases.create).toHaveLength(1);
    expect(aliases.create[0]?.alias).toBe("Chépica");
    expect(aliases.create[0]?.normalizedAlias).toBe(normalize("Chépica"));
    expect(aliases.create[0]?.aliasType).toBe("common");
  });

  it("starts at alg_0001 when the table is empty", async () => {
    mockDb.clinicalAllergen.findMany.mockResolvedValue([]);
    await createAllergen({ ...baseCreateInput, aliases: [] } as never);
    const arg = mockDb.clinicalAllergen.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data.id).toBe("alg_0001");
    expect(arg.data.aliases).toBeUndefined();
  });
});

describe("updateAllergen", () => {
  it("throws NOT_FOUND when the allergen does not exist", async () => {
    mockDb.clinicalAllergen.findUnique.mockResolvedValue(null);
    await expectDomainError(
      updateAllergen({ id: "alg_9999", commonName: "X" } as never),
      "NOT_FOUND",
      "Alérgeno no encontrado"
    );
    expect(mockDb.clinicalAllergen.update).not.toHaveBeenCalled();
  });

  it("recomputes normalizedCommonName when commonName changes", async () => {
    await updateAllergen({ id: "alg_0001", commonName: "Ácaro doméstico" } as never);
    const arg = mockDb.clinicalAllergen.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data.commonName).toBe("Ácaro doméstico");
    expect(arg.data.normalizedCommonName).toBe(normalize("Ácaro doméstico"));
  });

  it("replaces aliases: deletes existing then nests create", async () => {
    await updateAllergen({
      id: "alg_0001",
      aliases: [{ alias: "Nuevo", aliasType: "trade" }],
    } as never);
    expect(mockDb.clinicalAllergenAlias.deleteMany).toHaveBeenCalledWith({
      where: { allergenId: "alg_0001" },
    });
    const arg = mockDb.clinicalAllergen.update.mock.calls[0]?.[0] as {
      data: { aliases: { create: Record<string, unknown>[] } };
    };
    expect(arg.data.aliases.create[0]?.alias).toBe("Nuevo");
    expect(arg.data.aliases.create[0]?.normalizedAlias).toBe(normalize("Nuevo"));
  });

  it("does not touch aliases when the payload omits them", async () => {
    await updateAllergen({ id: "alg_0001", isActive: false } as never);
    expect(mockDb.clinicalAllergenAlias.deleteMany).not.toHaveBeenCalled();
  });
});

describe("deactivateAllergen", () => {
  it("throws NOT_FOUND when the allergen does not exist", async () => {
    mockDb.clinicalAllergen.findUnique.mockResolvedValue(null);
    await expectDomainError(deactivateAllergen("nope"), "NOT_FOUND", "Alérgeno no encontrado");
    expect(mockDb.clinicalAllergen.update).not.toHaveBeenCalled();
  });

  it("sets isActive false when found", async () => {
    await deactivateAllergen("alg_0001");
    expect(mockDb.clinicalAllergen.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "alg_0001" },
        data: { isActive: false },
      })
    );
  });
});

describe("listAllergens", () => {
  it("excludes inactive by default", async () => {
    await listAllergens();
    const arg = mockDb.clinicalAllergen.findMany.mock.calls[0]?.[0] as {
      where: { AND: Record<string, unknown>[] };
    };
    expect(arg.where.AND).toContainEqual({ isActive: true });
  });

  it("includes inactive when includeInactive is set (no isActive filter)", async () => {
    await listAllergens({ includeInactive: true });
    const arg = mockDb.clinicalAllergen.findMany.mock.calls[0]?.[0] as {
      where?: { AND?: Record<string, unknown>[] };
    };
    // No filters at all → where undefined.
    expect(arg.where).toBeUndefined();
  });

  it("builds an OR with normalizedCommonName contains UPPERCASE(q)", async () => {
    await listAllergens({ q: "chépica" });
    const arg = mockDb.clinicalAllergen.findMany.mock.calls[0]?.[0] as {
      where: { AND: { OR?: Record<string, unknown>[] }[] };
    };
    const orClause = arg.where.AND.find((c) => c.OR)?.OR;
    expect(orClause).toContainEqual({
      normalizedCommonName: { contains: normalize("chépica"), mode: "insensitive" },
    });
  });
});

describe("serializeAllergen", () => {
  it("maps aliases to {id, alias, aliasType}", () => {
    const result = serializeAllergen({
      id: "alg_0001",
      scientificName: "Sci",
      commonName: "Common",
      englishName: "Eng",
      category: "cat",
      categoryEn: "catEn",
      pollenType: null,
      pollenTypeEn: null,
      tags: ["t"],
      isActive: true,
      aliases: [{ id: "a1", alias: "Alias", aliasType: "common", normalizedAlias: "ALIAS" }],
    } as never);
    expect(result.aliases).toEqual([{ id: "a1", alias: "Alias", aliasType: "common" }]);
    expect(result.id).toBe("alg_0001");
  });
});
