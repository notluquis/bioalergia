import { beforeEach, describe, expect, it, vi } from "vitest";
import { isDomainError } from "../../lib/errors.ts";

// Characterization tests for the gs26 "handlers finos" extraction of the
// broadcast / scheduled-message / template families out of orpc/wa-cloud.ts.
// They pin the EXACT created/returned shapes, the DomainError kinds + Spanish
// messages, and the authz-vs-existence ordering invariants that the handlers
// used to enforce inline. The enqueueJob triggers stay in the handlers (verified
// separately by reading the diff) — these only cover service-extractable logic.

const { mockDb, graphMock } = vi.hoisted(() => {
  const mockDb = {
    waBroadcast: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    waBroadcastRecipient: { findMany: vi.fn(), updateMany: vi.fn() },
    waScheduledMessage: { create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    waConversation: { findUnique: vi.fn() },
    waTemplate: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  const graphMock = {
    listAccountTemplates: vi.fn(),
    createTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    cloneTemplateFromLibrary: vi.fn(),
    listTemplateLibrary: vi.fn(),
  };
  return { mockDb, graphMock };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => {
  const noopDb = { $setOptions: () => noopDb };
  return { dbClinicalSeries: noopDb };
});
vi.mock("../../lib/logger.ts", () => ({
  logError: vi.fn(),
  logEvent: vi.fn(),
}));
vi.mock("../../modules/wa-cloud/graph-client.ts", () => graphMock);

const {
  createBroadcast,
  listBroadcasts,
  getBroadcastDetail,
  startBroadcast,
  cancelBroadcast,
} = await import("../wa-broadcasts.ts");
const { createScheduledMessage, listScheduledForConversation, cancelScheduledMessage } =
  await import("../wa-scheduled.ts");
const {
  syncTemplates,
  listTemplates,
  createTemplate,
  listTemplateLibrary,
  cloneTemplateFromLibrary,
  deleteTemplate,
} = await import("../wa-templates.ts");

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Broadcasts ───────────────────────────────────────────────────────────────
describe("createBroadcast", () => {
  it("crea DRAFT cuando no hay scheduledAt y mapea los recipients", async () => {
    mockDb.waBroadcast.create.mockResolvedValue({ id: 7, status: "DRAFT" });
    const out = await createBroadcast(
      {
        accountId: 1,
        phoneNumberId: 2,
        name: "Promo",
        templateName: "promo_t",
        templateLanguage: "es",
        rateLimitPerSecond: 5,
        recipients: [{ phoneE164: "+56911112222", variables: ["A"] }],
      },
      42
    );
    expect(out).toEqual({ id: 7, status: "DRAFT" });
    const data = mockDb.waBroadcast.create.mock.calls[0]![0].data;
    expect(data.status).toBe("DRAFT");
    expect(data.scheduledAt).toBeNull();
    expect(data.createdByUserId).toBe(42);
    expect(data.totalRecipients).toBe(1);
    expect(data.recipients.create).toEqual([{ phoneE164: "+56911112222", variables: ["A"] }]);
  });

  it("crea QUEUED cuando viene scheduledAt", async () => {
    const when = new Date(Date.now() + 60_000);
    mockDb.waBroadcast.create.mockResolvedValue({ id: 8, status: "QUEUED" });
    await createBroadcast(
      {
        accountId: 1,
        phoneNumberId: 2,
        name: "Promo",
        templateName: "promo_t",
        templateLanguage: "es",
        scheduledAt: when,
        rateLimitPerSecond: 5,
        recipients: [{ phoneE164: "+56911112222", variables: [] }],
      },
      42
    );
    const data = mockDb.waBroadcast.create.mock.calls[0]![0].data;
    expect(data.status).toBe("QUEUED");
    expect(data.scheduledAt).toBe(when);
  });
});

describe("listBroadcasts", () => {
  it("devuelve hasta 100, orden desc por createdAt", async () => {
    mockDb.waBroadcast.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const out = await listBroadcasts();
    expect(out).toEqual({ broadcasts: [{ id: 1 }, { id: 2 }] });
    expect(mockDb.waBroadcast.findMany.mock.calls[0]![0]).toMatchObject({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  });
});

describe("getBroadcastDetail", () => {
  it("lanza NOT_FOUND con mensaje exacto cuando no existe", async () => {
    mockDb.waBroadcast.findUnique.mockResolvedValue(null);
    const err = await getBroadcastDetail(99).catch((e: unknown) => e);
    expect(isDomainError(err)).toBe(true);
    expect((err as { kind: string }).kind).toBe("NOT_FOUND");
    expect((err as Error).message).toBe("Broadcast no encontrado");
  });

  it("normaliza variables faltantes a [] en cada recipient", async () => {
    mockDb.waBroadcast.findUnique.mockResolvedValue({ id: 5 });
    mockDb.waBroadcastRecipient.findMany.mockResolvedValue([
      { id: 1, variables: ["x"] },
      { id: 2, variables: null },
    ]);
    const out = await getBroadcastDetail(5);
    expect(out.broadcast).toEqual({ id: 5 });
    expect(out.recipients).toEqual([
      { id: 1, variables: ["x"] },
      { id: 2, variables: [] },
    ]);
  });
});

describe("startBroadcast", () => {
  it("lanza NOT_FOUND cuando no existe", async () => {
    mockDb.waBroadcast.findUnique.mockResolvedValue(null);
    const err = await startBroadcast(1).catch((e: unknown) => e);
    expect((err as { kind: string }).kind).toBe("NOT_FOUND");
    expect((err as Error).message).toBe("Broadcast no encontrado");
  });

  it("lanza BAD_REQUEST con el estado interpolado cuando no es DRAFT/QUEUED", async () => {
    mockDb.waBroadcast.findUnique.mockResolvedValue({ id: 1, status: "SENDING" });
    const err = await startBroadcast(1).catch((e: unknown) => e);
    expect((err as { kind: string }).kind).toBe("BAD_REQUEST");
    expect((err as Error).message).toBe("Estado SENDING no permite iniciar");
    expect(mockDb.waBroadcast.update).not.toHaveBeenCalled();
  });

  it("marca QUEUED y default scheduledAt=now cuando estaba DRAFT sin fecha", async () => {
    mockDb.waBroadcast.findUnique.mockResolvedValue({ id: 1, status: "DRAFT", scheduledAt: null });
    mockDb.waBroadcast.update.mockResolvedValue({ id: 1, status: "QUEUED" });
    const out = await startBroadcast(1);
    expect(out).toEqual({ id: 1, status: "QUEUED" });
    const data = mockDb.waBroadcast.update.mock.calls[0]![0].data;
    expect(data.status).toBe("QUEUED");
    expect(data.scheduledAt).toBeInstanceOf(Date);
  });

  it("conserva scheduledAt existente al iniciar un QUEUED", async () => {
    const when = new Date(Date.now() + 120_000);
    mockDb.waBroadcast.findUnique.mockResolvedValue({ id: 1, status: "QUEUED", scheduledAt: when });
    mockDb.waBroadcast.update.mockResolvedValue({ id: 1, status: "QUEUED" });
    await startBroadcast(1);
    expect(mockDb.waBroadcast.update.mock.calls[0]![0].data.scheduledAt).toBe(when);
  });
});

describe("cancelBroadcast", () => {
  it("marca CANCELLED + SKIPPED a los PENDING con el motivo exacto", async () => {
    mockDb.waBroadcast.update.mockResolvedValue({});
    mockDb.waBroadcastRecipient.updateMany.mockResolvedValue({});
    await cancelBroadcast(3);
    expect(mockDb.waBroadcast.update.mock.calls[0]![0]).toMatchObject({
      where: { id: 3 },
      data: { status: "CANCELLED" },
    });
    expect(mockDb.waBroadcastRecipient.updateMany.mock.calls[0]![0]).toEqual({
      where: { broadcastId: 3, status: "PENDING" },
      data: { status: "SKIPPED", errorMessage: "Broadcast cancelado" },
    });
  });
});

// ── Scheduled messages ───────────────────────────────────────────────────────
describe("createScheduledMessage", () => {
  it("lanza NOT_FOUND con mensaje exacto si la conversación no existe", async () => {
    mockDb.waConversation.findUnique.mockResolvedValue(null);
    const err = await createScheduledMessage(
      {
        conversationId: 1,
        phoneNumberId: 2,
        scheduledAt: new Date(Date.now() + 60_000),
        type: "TEXT",
        body: "hola",
      },
      9
    ).catch((e: unknown) => e);
    expect((err as { kind: string }).kind).toBe("NOT_FOUND");
    expect((err as Error).message).toBe("Conversación no encontrada");
  });

  it("lanza BAD_REQUEST si la fecha es < 30s en el futuro", async () => {
    mockDb.waConversation.findUnique.mockResolvedValue({ id: 1, contactId: 5 });
    const err = await createScheduledMessage(
      {
        conversationId: 1,
        phoneNumberId: 2,
        scheduledAt: new Date(Date.now() + 5_000),
        type: "TEXT",
        body: "hola",
      },
      9
    ).catch((e: unknown) => e);
    expect((err as { kind: string }).kind).toBe("BAD_REQUEST");
    expect((err as Error).message).toBe("Programa al menos 30 segundos en el futuro");
    expect(mockDb.waScheduledMessage.create).not.toHaveBeenCalled();
  });

  it("crea con contactId derivado de la conversación y devuelve templateVars normalizado", async () => {
    mockDb.waConversation.findUnique.mockResolvedValue({ id: 1, contactId: 5 });
    mockDb.waScheduledMessage.create.mockResolvedValue({ id: 11, templateVars: null });
    const out = await createScheduledMessage(
      {
        conversationId: 1,
        phoneNumberId: 2,
        scheduledAt: new Date(Date.now() + 60_000),
        type: "TEXT",
        body: "hola",
      },
      9
    );
    expect(out).toEqual({ id: 11, templateVars: [] });
    const data = mockDb.waScheduledMessage.create.mock.calls[0]![0].data;
    expect(data.contactId).toBe(5);
    expect(data.createdByUserId).toBe(9);
    expect(data.body).toBe("hola");
  });
});

describe("listScheduledForConversation", () => {
  it("filtra por conversación y normaliza templateVars", async () => {
    mockDb.waScheduledMessage.findMany.mockResolvedValue([
      { id: 1, templateVars: ["a"] },
      { id: 2, templateVars: null },
    ]);
    const out = await listScheduledForConversation(3);
    expect(out.scheduled).toEqual([
      { id: 1, templateVars: ["a"] },
      { id: 2, templateVars: [] },
    ]);
    expect(mockDb.waScheduledMessage.findMany.mock.calls[0]![0]).toMatchObject({
      where: { conversationId: 3 },
      orderBy: { scheduledAt: "asc" },
    });
  });
});

describe("cancelScheduledMessage", () => {
  it("marca CANCELLED por id", async () => {
    mockDb.waScheduledMessage.update.mockResolvedValue({});
    await cancelScheduledMessage(8);
    expect(mockDb.waScheduledMessage.update.mock.calls[0]![0]).toEqual({
      where: { id: 8 },
      data: { status: "CANCELLED" },
    });
  });
});

// ── Templates ────────────────────────────────────────────────────────────────
describe("syncTemplates", () => {
  it("upsertea por clave name+language (update si existe, create si no) y devuelve total", async () => {
    graphMock.listAccountTemplates.mockResolvedValue([
      { id: "m1", name: "promo", language: "es", category: "MARKETING", status: "APPROVED", components: [], quality_score: { score: "GREEN" } },
      { id: "m2", name: "nuevo", language: "es", category: "UTILITY", status: "PENDING", components: [] },
    ]);
    mockDb.waTemplate.findMany
      .mockResolvedValueOnce([{ id: 100, name: "promo", language: "es" }]) // existing lookup
      .mockResolvedValueOnce([
        { id: 100, name: "promo", language: "es", components: [] },
        { id: 101, name: "nuevo", language: "es", components: null },
      ]); // final list
    mockDb.waTemplate.update.mockResolvedValue({});
    mockDb.waTemplate.create.mockResolvedValue({});

    const out = await syncTemplates(1);
    expect(out.total).toBe(2);
    // "promo" existed → update on id 100; "nuevo" did not → create
    expect(mockDb.waTemplate.update.mock.calls[0]![0].where).toEqual({ id: 100 });
    expect(mockDb.waTemplate.create).toHaveBeenCalledTimes(1);
    // components normalized
    expect(out.templates[1]!.components).toEqual([]);
  });
});

describe("listTemplates", () => {
  it("filtra por accountId cuando viene, normaliza components", async () => {
    mockDb.waTemplate.findMany.mockResolvedValue([{ id: 1, components: null }]);
    const out = await listTemplates(5);
    expect(mockDb.waTemplate.findMany.mock.calls[0]![0].where).toEqual({ accountId: 5 });
    expect(out.templates).toEqual([{ id: 1, components: [] }]);
  });

  it("where vacío cuando no viene accountId", async () => {
    mockDb.waTemplate.findMany.mockResolvedValue([]);
    await listTemplates();
    expect(mockDb.waTemplate.findMany.mock.calls[0]![0].where).toEqual({});
  });
});

describe("createTemplate", () => {
  it("llama a Meta y devuelve su respuesta; persiste best-effort", async () => {
    graphMock.createTemplate.mockResolvedValue({ id: "g1", status: "PENDING", category: "MARKETING" });
    mockDb.waTemplate.upsert.mockResolvedValue({});
    const out = await createTemplate({
      accountId: 1,
      name: "promo_x",
      language: "es",
      category: "MARKETING",
      components: [{ type: "BODY", text: "hi" }],
    });
    expect(out).toEqual({ id: "g1", status: "PENDING", category: "MARKETING" });
    expect(graphMock.createTemplate).toHaveBeenCalledTimes(1);
    expect(mockDb.waTemplate.upsert.mock.calls[0]![0].create.metaTemplateId).toBe("g1");
  });

  it("no rompe si la persistencia local falla (best-effort)", async () => {
    graphMock.createTemplate.mockResolvedValue({ id: "g2", status: "PENDING", category: "UTILITY" });
    mockDb.waTemplate.upsert.mockRejectedValue(new Error("db down"));
    const out = await createTemplate({
      accountId: 1,
      name: "u",
      language: "es",
      category: "UTILITY",
      components: [{ type: "BODY", text: "x" }],
    });
    expect(out.id).toBe("g2");
  });
});

describe("listTemplateLibrary", () => {
  it("devuelve el catálogo de Meta cuando responde", async () => {
    graphMock.listTemplateLibrary.mockResolvedValue([{ id: "lib1" }]);
    const out = await listTemplateLibrary({ accountId: 1 });
    expect(out).toEqual({ templates: [{ id: "lib1" }] });
  });

  it("degrada a [] cuando Meta dice 'nonexisting field' (tier sin catálogo)", async () => {
    graphMock.listTemplateLibrary.mockRejectedValue(
      new Error("(#100) Tried accessing nonexisting field (message_template_library)")
    );
    const out = await listTemplateLibrary({ accountId: 1 });
    expect(out).toEqual({ templates: [] });
  });

  it("propaga errores que NO son de tier", async () => {
    graphMock.listTemplateLibrary.mockRejectedValue(new Error("network boom"));
    const err = await listTemplateLibrary({ accountId: 1 }).catch((e: unknown) => e);
    expect((err as Error).message).toBe("network boom");
  });
});

describe("cloneTemplateFromLibrary", () => {
  it("clona en Meta y persiste con newName cuando se da", async () => {
    graphMock.cloneTemplateFromLibrary.mockResolvedValue({ id: "c1", status: "APPROVED", category: "MARKETING" });
    mockDb.waTemplate.upsert.mockResolvedValue({});
    const out = await cloneTemplateFromLibrary({
      accountId: 1,
      libraryTemplateName: "src",
      newName: "dst",
      language: "es",
      category: "MARKETING",
    });
    expect(out).toEqual({ id: "c1", status: "APPROVED", category: "MARKETING" });
    expect(mockDb.waTemplate.upsert.mock.calls[0]![0].create.name).toBe("dst");
  });
});

describe("deleteTemplate", () => {
  it("borra en Meta y limpia local por accountId+name", async () => {
    graphMock.deleteTemplate.mockResolvedValue({});
    mockDb.waTemplate.deleteMany.mockResolvedValue({});
    await deleteTemplate(1, "promo");
    expect(graphMock.deleteTemplate).toHaveBeenCalledWith(1, "promo", undefined);
    expect(mockDb.waTemplate.deleteMany.mock.calls[0]![0]).toEqual({
      where: { accountId: 1, name: "promo" },
    });
  });
});
