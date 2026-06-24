import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError, type DomainErrorKind } from "../../lib/errors.ts";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    quoteProduct: {
      findMany: vi.fn(),
    },
    reactivoLead: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  return { mockDb };
});

const { sendNotification } = vi.hoisted(() => ({ sendNotification: vi.fn() }));

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));
vi.mock("../../lib/settings.ts", () => ({
  loadSettings: vi.fn().mockResolvedValue({ reactivoLeadsEmail: "x@y.cl" }),
}));
vi.mock("../email/transactional.ts", () => ({
  sendReactivoLeadNotification: sendNotification,
}));
vi.mock("../../lib/logger.ts", () => ({ logError: vi.fn(), logEvent: vi.fn() }));

const { serializeVitrinaItem, listVitrina, createLead, updateLeadStatus } =
  await import("../reactivos.ts");

// Asserts a rejected promise is a DomainError with the expected kind + message.
// Resists Stryker mutations: checks the concrete class, the discriminator, AND
// the message — flipping any of the three is caught.
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
  mockDb.quoteProduct.findMany.mockResolvedValue([]);
  mockDb.reactivoLead.create.mockImplementation(async ({ data }: { data: unknown }) => ({
    id: 99,
    ...(data as Record<string, unknown>),
  }));
  mockDb.reactivoLead.findMany.mockResolvedValue([]);
  mockDb.reactivoLead.findUnique.mockResolvedValue({ id: 1, status: "NEW" });
  mockDb.reactivoLead.update.mockImplementation(async ({ data }: { data: unknown }) => data);
  sendNotification.mockResolvedValue(undefined);
});

describe("serializeVitrinaItem", () => {
  it("NEVER exposes unitPrice even when present on the row (privacy)", () => {
    const result = serializeVitrinaItem({
      id: 1,
      slug: "s",
      code: "c",
      brand: "b",
      category: "cat",
      name: "n",
      format: "f",
      description: "d",
      imageUrl: "img",
      unitPrice: 12_345,
      allergen: {
        id: "alg_0001",
        commonName: "Polen",
        scientificName: "Pollenus",
        category: "polen",
      },
    } as never);
    expect("unitPrice" in result).toBe(false);
    expect(result.allergen).toEqual({
      id: "alg_0001",
      commonName: "Polen",
      scientificName: "Pollenus",
      category: "polen",
    });
  });

  it("maps a null allergen to null", () => {
    const result = serializeVitrinaItem({
      id: 2,
      slug: "s",
      code: "c",
      brand: "b",
      category: "cat",
      name: "n",
      format: "f",
      description: "d",
      imageUrl: "img",
      unitPrice: 1,
      allergen: null,
    } as never);
    expect(result.allergen).toBeNull();
    expect("unitPrice" in result).toBe(false);
  });
});

describe("listVitrina", () => {
  it("queries only published + active products", async () => {
    await listVitrina();
    expect(mockDb.quoteProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { publishedOnSite: true, isActive: true },
      })
    );
  });
});

describe("createLead", () => {
  it("honeypot: a non-empty website returns a fake id without persisting or notifying", async () => {
    const result = await createLead({
      empresa: "Spam SA",
      contactName: "Bot",
      email: "bot@spam.cl",
      productsOfInterest: [],
      website: "http://spam",
    } as never);
    expect(result).toEqual({ ok: true, id: 0 });
    expect(mockDb.reactivoLead.create).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("happy path: persists a trimmed lead, notifies the team, returns the created id", async () => {
    mockDb.reactivoLead.create.mockResolvedValue({
      id: 7,
      empresa: "Clinica X",
      contactName: "Ana",
      email: "ana@x.cl",
      phone: "+569",
      rut: "1-9",
      message: "Hola",
      productsOfInterest: ["p1"],
    });
    const result = await createLead({
      empresa: "  Clinica X  ",
      contactName: "  Ana  ",
      email: "  ana@x.cl  ",
      phone: "  +569  ",
      rut: "  1-9  ",
      message: "  Hola  ",
      productsOfInterest: ["p1"],
      website: "",
    } as never);

    expect(mockDb.reactivoLead.create).toHaveBeenCalledWith({
      data: {
        empresa: "Clinica X",
        contactName: "Ana",
        email: "ana@x.cl",
        phone: "+569",
        rut: "1-9",
        message: "Hola",
        productsOfInterest: ["p1"],
        source: "venta-empresas",
      },
    });
    expect(sendNotification).toHaveBeenCalledWith({
      to: "x@y.cl",
      lead: {
        id: 7,
        empresa: "Clinica X",
        contactName: "Ana",
        email: "ana@x.cl",
        phone: "+569",
        rut: "1-9",
        message: "Hola",
        productsOfInterest: ["p1"],
      },
    });
    expect(result).toEqual({ ok: true, id: 7 });
  });

  it("nullifies blank optional fields", async () => {
    await createLead({
      empresa: "E",
      contactName: "C",
      email: "e@e.cl",
      phone: "",
      rut: "",
      message: "",
      productsOfInterest: [],
      website: "",
    } as never);
    const arg = mockDb.reactivoLead.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(arg.data.phone).toBeNull();
    expect(arg.data.rut).toBeNull();
    expect(arg.data.message).toBeNull();
  });

  it("email notification failure is best-effort: lead still persists and resolves ok", async () => {
    mockDb.reactivoLead.create.mockResolvedValue({
      id: 42,
      empresa: "E",
      contactName: "C",
      email: "e@e.cl",
      phone: null,
      rut: null,
      message: null,
      productsOfInterest: [],
    });
    const { logError } = await import("../../lib/logger.ts");
    sendNotification.mockRejectedValue(new Error("resend down"));

    const result = await createLead({
      empresa: "E",
      contactName: "C",
      email: "e@e.cl",
      productsOfInterest: [],
      website: "",
    } as never);

    expect(result).toEqual({ ok: true, id: 42 });
    expect(mockDb.reactivoLead.create).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalled();
  });
});

describe("updateLeadStatus", () => {
  it("throws NOT_FOUND when the lead does not exist", async () => {
    mockDb.reactivoLead.findUnique.mockResolvedValue(null);
    await expectDomainError(
      updateLeadStatus(404, "CONTACTED" as never),
      "NOT_FOUND",
      "Lead no encontrado"
    );
    expect(mockDb.reactivoLead.update).not.toHaveBeenCalled();
  });

  it("updates the status when the lead exists", async () => {
    await updateLeadStatus(1, "CONTACTED" as never);
    expect(mockDb.reactivoLead.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "CONTACTED" },
    });
  });
});
