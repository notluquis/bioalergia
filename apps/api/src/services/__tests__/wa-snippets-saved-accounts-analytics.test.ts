import { beforeEach, describe, expect, it, vi } from "vitest";
import { isDomainError } from "../../lib/errors.ts";

// Characterization tests for the gs26 "handlers finos" extraction of the
// SNIPPETS / SAVED (locations·lists·flows) / ACCOUNTS (+phones·commerce) /
// ANALYTICS (webhook-logs·account-events·phone-health·quality-summary)
// families out of orpc/wa-cloud.ts (batch 3). They pin the EXACT persisted
// shapes, the CRUD where/order clauses, the 24h-window + blocked-contact +
// not-found guards, the DomainError kinds + Spanish messages, the Json→array
// mapping the contract expects, and that the Graph-client / fetch calls stay
// intact. The graph-client sends + global fetch are mocked.

const { mockDb, graphMock, cipherMock } = vi.hoisted(() => {
  const mockDb = {
    waSnippet: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    waConversation: { findUnique: vi.fn(), update: vi.fn() },
    waMessage: { create: vi.fn() },
    waPhoneNumber: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    waSavedLocation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    waSavedInteractiveList: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    waSavedFlow: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    waBusinessAccount: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    waAccountEvent: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), update: vi.fn() },
    waWebhookLog: { findMany: vi.fn() },
  };
  const graphMock = {
    sendTextMessage: vi.fn(),
    sendMediaMessage: vi.fn(),
    sendLocationMessage: vi.fn(),
    sendInteractiveListMessage: vi.fn(),
    sendFlowMessage: vi.fn(),
    sendSingleProductMessage: vi.fn(),
    sendMultiProductMessage: vi.fn(),
    listCommerceProducts: vi.fn(),
    listAccountFlows: vi.fn(),
    listAccountPhoneNumbers: vi.fn(),
    listAccountTemplates: vi.fn(),
    getPhoneHealth: vi.fn(),
  };
  const cipherMock = { encryptSecret: vi.fn((v: string) => `enc:${v}`), decryptSecret: vi.fn() };
  return { mockDb, graphMock, cipherMock };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => {
  const noopDb = { $setOptions: () => noopDb };
  return { dbClinicalSeries: noopDb };
});
vi.mock("../../lib/logger.ts", () => ({ logError: vi.fn(), logEvent: vi.fn() }));
vi.mock("../../lib/secret-cipher.ts", () => cipherMock);
vi.mock("../../modules/wa-cloud/graph-client.ts", () => graphMock);

const { listSnippets, upsertSnippet, archiveSnippet, sendSnippet } =
  await import("../wa-snippets.ts");
const {
  listSavedLocations,
  upsertSavedLocation,
  archiveSavedLocation,
  listSavedInteractiveLists,
  upsertSavedInteractiveList,
  listSavedFlows,
  syncFlows,
  sendSavedLocation,
  sendSavedList,
  sendSavedFlow,
} = await import("../wa-saved.ts");
const {
  listAccounts,
  upsertAccount,
  deleteAccount,
  validateAccount,
  syncPhoneNumbers,
  upsertPhoneNumber,
  setCommerceCatalog,
  listCommerceProductsForAccount,
  sendSingleProduct,
  sendMultiProduct,
} = await import("../wa-accounts.ts");
const {
  listWebhookLogs,
  listAccountEvents,
  acknowledgeAccountEvent,
  getPhoneHealth,
  getPhoneQualitySummary,
} = await import("../wa-analytics.ts");

const OPEN = () => new Date(Date.now() - 60_000); // 1 min ago → window open
const CLOSED = () => new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h ago → closed

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Snippets ─────────────────────────────────────────────────────────────────
describe("listSnippets", () => {
  it("arma where con archived:false + q OR insensitive y mapea Json→array", async () => {
    mockDb.waSnippet.findMany.mockResolvedValue([{ id: 1, replyButtons: null, variables: null }]);
    const out = await listSnippets({ q: "hola", kind: "TEXT" });
    const args = mockDb.waSnippet.findMany.mock.calls[0]![0];
    expect(args.where.archived).toBe(false);
    expect(args.where.kind).toBe("TEXT");
    expect(args.where.OR[0].name.mode).toBe("insensitive");
    expect(args.orderBy).toEqual([{ hitCount: "desc" }, { name: "asc" }]);
    expect(out.snippets[0]!.replyButtons).toBeNull();
    expect(out.snippets[0]!.variables).toEqual([]);
  });
});

describe("upsertSnippet", () => {
  it("create estampa createdByUserId y mediaHandleExpiresAt +30d cuando hay handle", async () => {
    mockDb.waSnippet.create.mockResolvedValue({ id: 9, replyButtons: null, variables: [] });
    await upsertSnippet({ kind: "TEXT", name: "n", mediaHandle: "h1" }, 7);
    const data = mockDb.waSnippet.create.mock.calls[0]![0].data;
    expect(data.createdByUserId).toBe(7);
    expect(data.mediaHandleExpiresAt).toBeInstanceOf(Date);
  });
});

describe("archiveSnippet", () => {
  it("setea archived:true", async () => {
    mockDb.waSnippet.update.mockResolvedValue({});
    await archiveSnippet(4);
    expect(mockDb.waSnippet.update.mock.calls[0]![0]).toEqual({
      where: { id: 4 },
      data: { archived: true },
    });
  });
});

describe("sendSnippet", () => {
  it("lanza NOT_FOUND si el snippet no existe o está archivado", async () => {
    mockDb.waSnippet.findUnique.mockResolvedValue(null);
    const err = await sendSnippet({ snippetId: 1, conversationId: 2, phoneNumberId: 3 }, 9).catch(
      (e: unknown) => e
    );
    expect(isDomainError(err)).toBe(true);
    expect((err as { kind: string }).kind).toBe("NOT_FOUND");
    expect((err as Error).message).toBe("Snippet no existe");
  });

  it("lanza BAD_REQUEST con ventana cerrada (TEXT) sin llamar Meta", async () => {
    mockDb.waSnippet.findUnique.mockResolvedValue({ id: 1, kind: "TEXT", archived: false });
    mockDb.waConversation.findUnique.mockResolvedValue({
      id: 2,
      contactId: 5,
      lastInboundAt: CLOSED(),
      contact: { phoneE164: "+569", blockedAt: null },
    });
    const err = await sendSnippet({ snippetId: 1, conversationId: 2, phoneNumberId: 3 }, 9).catch(
      (e: unknown) => e
    );
    expect((err as { kind: string }).kind).toBe("BAD_REQUEST");
    expect((err as Error).message).toContain("Ventana 24h cerrada");
    expect(graphMock.sendTextMessage).not.toHaveBeenCalled();
  });

  it("TEXT: envía por Meta, persiste TEXT y bumpea hitCount", async () => {
    mockDb.waSnippet.findUnique.mockResolvedValue({
      id: 1,
      kind: "TEXT",
      archived: false,
      bodyText: "Hola {{1}}",
    });
    mockDb.waConversation.findUnique.mockResolvedValue({
      id: 2,
      contactId: 5,
      lastInboundAt: OPEN(),
      contact: { phoneE164: "+56999", blockedAt: null },
    });
    graphMock.sendTextMessage.mockResolvedValue({ messages: [{ id: "wamid.s" }] });
    mockDb.waMessage.create.mockResolvedValue({ id: 50 });
    mockDb.waConversation.update.mockResolvedValue({});
    mockDb.waSnippet.update.mockResolvedValue({});
    const out = await sendSnippet(
      { snippetId: 1, conversationId: 2, phoneNumberId: 3, variableValues: ["Ana"] },
      9
    );
    expect(out).toEqual({ message: { id: 50 } });
    expect(graphMock.sendTextMessage).toHaveBeenCalledWith({
      phoneNumberId: 3,
      toE164: "+56999",
      body: "Hola Ana",
    });
    expect(mockDb.waMessage.create.mock.calls[0]![0].data.type).toBe("TEXT");
    expect(mockDb.waSnippet.update.mock.calls[0]![0].data.hitCount).toEqual({ increment: 1 });
  });

  it("CTA_URL: fetch directo a Graph con token desencriptado, BAD_GATEWAY si Meta falla", async () => {
    mockDb.waSnippet.findUnique.mockResolvedValue({
      id: 1,
      kind: "CTA_URL",
      archived: false,
      bodyText: "b",
      ctaUrl: "https://x",
      ctaButtonText: "Ir",
    });
    mockDb.waConversation.findUnique.mockResolvedValue({
      id: 2,
      contactId: 5,
      lastInboundAt: OPEN(),
      contact: { phoneE164: "+56999", blockedAt: null },
    });
    mockDb.waPhoneNumber.findUnique.mockResolvedValue({
      phoneNumberId: "PN1",
      account: { systemUserToken: "enc-tok", graphApiVersion: "v21.0" },
    });
    cipherMock.decryptSecret.mockReturnValue("plain-tok");
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 400, text: async () => "boom" });
    vi.stubGlobal("fetch", fetchMock);
    const err = await sendSnippet({ snippetId: 1, conversationId: 2, phoneNumberId: 3 }, 9).catch(
      (e: unknown) => e
    );
    // ORPCError BAD_GATEWAY preserved (not a DomainError)
    expect(isDomainError(err)).toBe(false);
    expect((err as Error).message).toContain("Meta CTA 400");
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe("Bearer plain-tok");
    vi.unstubAllGlobals();
  });
});

// ── Saved entities ───────────────────────────────────────────────────────────
describe("listSavedLocations", () => {
  it("filtra archived:false y ordena isDefault desc luego name", async () => {
    mockDb.waSavedLocation.findMany.mockResolvedValue([{ id: 1 }]);
    await listSavedLocations();
    const args = mockDb.waSavedLocation.findMany.mock.calls[0]![0];
    expect(args.where).toEqual({ archived: false });
    expect(args.orderBy).toEqual([{ isDefault: "desc" }, { name: "asc" }]);
  });
});

describe("upsertSavedLocation", () => {
  it("isDefault=true limpia el default anterior antes de crear", async () => {
    mockDb.waSavedLocation.updateMany.mockResolvedValue({});
    mockDb.waSavedLocation.create.mockResolvedValue({ id: 1 });
    await upsertSavedLocation(
      { name: "Clínica", latitude: -33, longitude: -70, isDefault: true },
      7
    );
    expect(mockDb.waSavedLocation.updateMany.mock.calls[0]![0]).toEqual({
      where: { isDefault: true },
      data: { isDefault: false },
    });
    expect(mockDb.waSavedLocation.create.mock.calls[0]![0].data.createdByUserId).toBe(7);
  });
});

describe("archiveSavedLocation", () => {
  it("setea archived:true", async () => {
    mockDb.waSavedLocation.update.mockResolvedValue({});
    await archiveSavedLocation(3);
    expect(mockDb.waSavedLocation.update.mock.calls[0]![0]).toEqual({
      where: { id: 3 },
      data: { archived: true },
    });
  });
});

describe("listSavedInteractiveLists", () => {
  it("mapea sections Json→array", async () => {
    mockDb.waSavedInteractiveList.findMany.mockResolvedValue([{ id: 1, sections: null }]);
    const out = await listSavedInteractiveLists();
    expect(out.lists[0]!.sections).toEqual([]);
  });
});

describe("upsertSavedInteractiveList", () => {
  it("create estampa createdByUserId", async () => {
    mockDb.waSavedInteractiveList.create.mockResolvedValue({ id: 1, sections: [] });
    await upsertSavedInteractiveList(
      { name: "n", bodyText: "b", buttonText: "Ver", sections: [] },
      7
    );
    expect(mockDb.waSavedInteractiveList.create.mock.calls[0]![0].data.createdByUserId).toBe(7);
  });
});

describe("listSavedFlows", () => {
  it("filtra archived:false ordena por name", async () => {
    mockDb.waSavedFlow.findMany.mockResolvedValue([{ id: 1 }]);
    await listSavedFlows();
    expect(mockDb.waSavedFlow.findMany.mock.calls[0]![0]).toEqual({
      where: { archived: false },
      orderBy: { name: "asc" },
    });
  });
});

describe("syncFlows", () => {
  it("upsertea remote flows (update existentes / create nuevos) y devuelve fetched/upserted", async () => {
    graphMock.listAccountFlows.mockResolvedValue([
      { id: "f1", name: "Flow 1", status: "PUBLISHED", categories: ["X"] },
      { id: "f2", name: "Flow 2" },
    ]);
    mockDb.waSavedFlow.findMany
      .mockResolvedValueOnce([{ flowId: "f1", name: "f1", accountId: null }]) // existing batch
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }]); // final list
    mockDb.waSavedFlow.update.mockResolvedValue({});
    mockDb.waSavedFlow.create.mockResolvedValue({});
    const out = await syncFlows({ accountId: 5 }, 7);
    expect(out.fetched).toBe(2);
    expect(out.upserted).toBe(2);
    expect(mockDb.waSavedFlow.update).toHaveBeenCalledTimes(1);
    expect(mockDb.waSavedFlow.create).toHaveBeenCalledTimes(1);
    expect(mockDb.waSavedFlow.create.mock.calls[0]![0].data.createdByUserId).toBe(7);
  });
});

describe("sendSavedLocation", () => {
  it("lanza NOT_FOUND si la ubicación no existe", async () => {
    mockDb.waSavedLocation.findUnique.mockResolvedValue(null);
    const err = await sendSavedLocation(
      { savedLocationId: 1, conversationId: 2, phoneNumberId: 3 },
      9
    ).catch((e: unknown) => e);
    expect((err as { kind: string }).kind).toBe("NOT_FOUND");
    expect((err as Error).message).toBe("Ubicación no existe");
  });

  it("NO exige ventana abierta; envía LOCATION con saved_location_id en payload", async () => {
    mockDb.waSavedLocation.findUnique.mockResolvedValue({
      id: 1,
      archived: false,
      name: "Clínica",
      latitude: -33,
      longitude: -70,
      address: "Av",
    });
    mockDb.waConversation.findUnique.mockResolvedValue({
      id: 2,
      contactId: 5,
      lastInboundAt: CLOSED(), // cerrada NO debe importar
      contact: { phoneE164: "+56999" },
    });
    graphMock.sendLocationMessage.mockResolvedValue({ messages: [{ id: "wamid.l" }] });
    mockDb.waMessage.create.mockResolvedValue({ id: 50 });
    mockDb.waConversation.update.mockResolvedValue({});
    await sendSavedLocation({ savedLocationId: 1, conversationId: 2, phoneNumberId: 3 }, 9);
    expect(graphMock.sendLocationMessage).toHaveBeenCalledTimes(1);
    const data = mockDb.waMessage.create.mock.calls[0]![0].data;
    expect(data.type).toBe("LOCATION");
    expect(data.payload.saved_location_id).toBe(1);
  });
});

describe("sendSavedList", () => {
  it("exige ventana abierta", async () => {
    mockDb.waSavedInteractiveList.findUnique.mockResolvedValue({ id: 1, archived: false });
    mockDb.waConversation.findUnique.mockResolvedValue({
      id: 2,
      contactId: 5,
      lastInboundAt: CLOSED(),
      contact: { phoneE164: "+569" },
    });
    const err = await sendSavedList(
      { savedListId: 1, conversationId: 2, phoneNumberId: 3 },
      9
    ).catch((e: unknown) => e);
    expect((err as { kind: string }).kind).toBe("BAD_REQUEST");
    expect(graphMock.sendInteractiveListMessage).not.toHaveBeenCalled();
  });
});

describe("sendSavedFlow", () => {
  it("lanza NOT_FOUND si el flow no existe", async () => {
    mockDb.waSavedFlow.findUnique.mockResolvedValue(null);
    const err = await sendSavedFlow(
      { savedFlowId: 1, conversationId: 2, phoneNumberId: 3 },
      9
    ).catch((e: unknown) => e);
    expect((err as { kind: string }).kind).toBe("NOT_FOUND");
    expect((err as Error).message).toBe("Flow no existe");
  });
});

// ── Accounts / phones / commerce ─────────────────────────────────────────────
describe("listAccounts", () => {
  it("enmascara secretos (hasToken/hasAppSecret/hasVerifyToken)", async () => {
    mockDb.waBusinessAccount.findMany.mockResolvedValue([
      {
        id: 1,
        wabaId: "w",
        metaBusinessId: null,
        appId: null,
        graphApiVersion: "v21.0",
        displayName: null,
        active: true,
        systemUserToken: "enc-x",
        appSecret: null,
        webhookVerifyToken: null,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        phoneNumbers: [],
      },
    ]);
    const out = await listAccounts();
    const acc = out.accounts[0]! as unknown as Record<string, unknown>;
    expect(acc.hasToken).toBe(true);
    expect(acc.hasAppSecret).toBe(false);
    expect(acc.systemUserToken).toBeUndefined();
  });
});

describe("upsertAccount", () => {
  it("encripta secretos antes del create", async () => {
    mockDb.waBusinessAccount.create.mockResolvedValue({ id: 9 });
    mockDb.waBusinessAccount.findUnique.mockResolvedValue({
      id: 9,
      wabaId: "w",
      metaBusinessId: null,
      appId: null,
      graphApiVersion: "v21.0",
      displayName: null,
      active: true,
      systemUserToken: "enc:tok",
      appSecret: null,
      webhookVerifyToken: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      phoneNumbers: [],
    });
    await upsertAccount({ wabaId: "w", systemUserToken: "tok" });
    expect(cipherMock.encryptSecret).toHaveBeenCalledWith("tok");
    expect(mockDb.waBusinessAccount.create.mock.calls[0]![0].data.systemUserToken).toBe("enc:tok");
  });
});

describe("deleteAccount", () => {
  it("borra por id", async () => {
    mockDb.waBusinessAccount.delete.mockResolvedValue({});
    await deleteAccount(3);
    expect(mockDb.waBusinessAccount.delete.mock.calls[0]![0]).toEqual({ where: { id: 3 } });
  });
});

describe("validateAccount", () => {
  it("ok:true con conteos; ok:false captura el error de Meta", async () => {
    graphMock.listAccountPhoneNumbers.mockResolvedValue([{ id: "p" }]);
    graphMock.listAccountTemplates.mockResolvedValue([{ name: "t" }, { name: "u" }]);
    const ok = await validateAccount(1);
    expect(ok).toEqual({ ok: true, phoneNumbersFound: 1, templatesFound: 2, error: null });

    graphMock.listAccountPhoneNumbers.mockRejectedValue(new Error("meta down"));
    const bad = await validateAccount(1);
    expect(bad.ok).toBe(false);
    expect(bad.error).toBe("meta down");
  });
});

describe("syncPhoneNumbers", () => {
  it("batchea existentes y upsertea cada phone remoto", async () => {
    graphMock.listAccountPhoneNumbers.mockResolvedValue([
      {
        id: "PN1",
        display_phone_number: "+56 9",
        verified_name: "Recepción",
        quality_rating: "GREEN",
      },
    ]);
    mockDb.waPhoneNumber.findMany.mockResolvedValue([]);
    mockDb.waPhoneNumber.create.mockResolvedValue({});
    mockDb.waBusinessAccount.findUnique.mockResolvedValue({
      id: 1,
      wabaId: "w",
      metaBusinessId: null,
      appId: null,
      graphApiVersion: "v21.0",
      displayName: null,
      active: true,
      systemUserToken: null,
      appSecret: null,
      webhookVerifyToken: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      phoneNumbers: [],
    });
    await syncPhoneNumbers(1);
    expect(mockDb.waPhoneNumber.create).toHaveBeenCalledTimes(1);
    expect(mockDb.waPhoneNumber.create.mock.calls[0]![0].data.phoneNumberId).toBe("PN1");
  });
});

describe("upsertPhoneNumber", () => {
  it("update cuando viene id", async () => {
    mockDb.waPhoneNumber.update.mockResolvedValue({});
    mockDb.waBusinessAccount.findUnique.mockResolvedValue({
      id: 1,
      wabaId: "w",
      metaBusinessId: null,
      appId: null,
      graphApiVersion: "v21.0",
      displayName: null,
      active: true,
      systemUserToken: null,
      appSecret: null,
      webhookVerifyToken: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      phoneNumbers: [],
    });
    await upsertPhoneNumber({
      id: 5,
      accountId: 1,
      phoneNumberId: "PN1",
      displayPhoneNumber: "+56 9",
    });
    expect(mockDb.waPhoneNumber.update.mock.calls[0]![0].where).toEqual({ id: 5 });
  });
});

describe("setCommerceCatalog", () => {
  it("setea commerceCatalogId", async () => {
    mockDb.waBusinessAccount.update.mockResolvedValue({});
    await setCommerceCatalog({ accountId: 1, catalogId: "CAT" });
    expect(mockDb.waBusinessAccount.update.mock.calls[0]![0]).toEqual({
      where: { id: 1 },
      data: { commerceCatalogId: "CAT" },
    });
  });
});

describe("listCommerceProductsForAccount", () => {
  it("retorna vacío cuando no hay catálogo", async () => {
    mockDb.waBusinessAccount.findUnique.mockResolvedValue({ commerceCatalogId: null });
    const out = await listCommerceProductsForAccount({ accountId: 1, limit: 10 });
    expect(out).toEqual({ catalogId: null, products: [] });
    expect(graphMock.listCommerceProducts).not.toHaveBeenCalled();
  });
});

describe("sendSingleProduct", () => {
  it("lanza BAD_REQUEST si no hay catálogo configurado", async () => {
    mockDb.waConversation.findUnique.mockResolvedValue({
      id: 2,
      contactId: 5,
      lastInboundAt: OPEN(),
      contact: { phoneE164: "+569" },
    });
    mockDb.waPhoneNumber.findUnique.mockResolvedValue({ account: { commerceCatalogId: null } });
    const err = await sendSingleProduct(
      { conversationId: 2, phoneNumberId: 3, productRetailerId: "R1" },
      9
    ).catch((e: unknown) => e);
    expect((err as { kind: string }).kind).toBe("BAD_REQUEST");
    expect((err as Error).message).toContain("Catálogo Meta Commerce no configurado");
  });
});

describe("sendMultiProduct", () => {
  it("exige ventana abierta", async () => {
    mockDb.waConversation.findUnique.mockResolvedValue({
      id: 2,
      contactId: 5,
      lastInboundAt: CLOSED(),
      contact: { phoneE164: "+569" },
    });
    mockDb.waPhoneNumber.findUnique.mockResolvedValue({ account: { commerceCatalogId: "CAT" } });
    const err = await sendMultiProduct(
      { conversationId: 2, phoneNumberId: 3, headerText: "h", sections: [] },
      9
    ).catch((e: unknown) => e);
    expect((err as { kind: string }).kind).toBe("BAD_REQUEST");
    expect((err as Error).message).toContain("MPM requiere ventana abierta");
  });
});

// ── Analytics ────────────────────────────────────────────────────────────────
describe("listWebhookLogs", () => {
  it("onlyInvalid filtra signatureValid:false y deriva fields del payload", async () => {
    mockDb.waWebhookLog.findMany.mockResolvedValue([
      {
        id: 1,
        receivedAt: new Date(0),
        signatureValid: false,
        processed: true,
        eventCount: 1,
        errorMessage: null,
        payload: { entry: [{ changes: [{ field: "messages" }, { field: "messages" }] }] },
      },
    ]);
    const out = await listWebhookLogs({ limit: 10, onlyInvalid: true });
    expect(mockDb.waWebhookLog.findMany.mock.calls[0]![0].where).toEqual({ signatureValid: false });
    expect(out.logs[0]!.fields).toEqual(["messages"]); // dedup
  });
});

describe("listAccountEvents", () => {
  it("arma where opcional + devuelve unacknowledgedCount", async () => {
    mockDb.waAccountEvent.findMany.mockResolvedValue([{ id: 1 }]);
    mockDb.waAccountEvent.count.mockResolvedValue(3);
    const out = await listAccountEvents({ acknowledged: false, severity: "critical", limit: 10 });
    expect(mockDb.waAccountEvent.findMany.mock.calls[0]![0].where).toEqual({
      acknowledged: false,
      severity: "critical",
    });
    expect(out.unacknowledgedCount).toBe(3);
  });
});

describe("acknowledgeAccountEvent", () => {
  it("estampa acknowledged + acknowledgedByUserId", async () => {
    mockDb.waAccountEvent.update.mockResolvedValue({});
    await acknowledgeAccountEvent({ id: 4 }, 7);
    const data = mockDb.waAccountEvent.update.mock.calls[0]![0].data;
    expect(data.acknowledged).toBe(true);
    expect(data.acknowledgedByUserId).toBe(7);
    expect(data.acknowledgedAt).toBeInstanceOf(Date);
  });
});

describe("getPhoneHealth", () => {
  it("best-effort: persiste qualityRating pero no rompe si el update falla", async () => {
    graphMock.getPhoneHealth.mockResolvedValue({ id: "PN1", quality_rating: "GREEN" });
    mockDb.waPhoneNumber.update.mockRejectedValue(new Error("db down"));
    const out = await getPhoneHealth({ phoneNumberId: 3 });
    expect(out.quality_rating).toBe("GREEN");
    expect(mockDb.waPhoneNumber.update).toHaveBeenCalledTimes(1);
  });
});

describe("getPhoneQualitySummary", () => {
  it("lanza NOT_FOUND si el phone no existe", async () => {
    mockDb.waPhoneNumber.findUnique.mockResolvedValue(null);
    const err = await getPhoneQualitySummary({ phoneNumberId: 3 }).catch((e: unknown) => e);
    expect((err as { kind: string }).kind).toBe("NOT_FOUND");
    expect((err as Error).message).toBe("Phone no encontrado");
  });

  it("mapea qualityRating válido y cuenta críticos/warnings", async () => {
    mockDb.waPhoneNumber.findUnique.mockResolvedValue({ id: 3, qualityRating: "YELLOW" });
    mockDb.waAccountEvent.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    mockDb.waAccountEvent.findFirst.mockResolvedValue({ receivedAt: new Date(0) });
    const out = await getPhoneQualitySummary({ phoneNumberId: 3 });
    expect(out.qualityRating).toBe("YELLOW");
    expect(out.criticalUnacknowledged).toBe(2);
    expect(out.warningUnacknowledged).toBe(1);
  });

  it("qualityRating fuera del enum permitido → null", async () => {
    mockDb.waPhoneNumber.findUnique.mockResolvedValue({ id: 3, qualityRating: "UNKNOWN" });
    mockDb.waAccountEvent.count.mockResolvedValue(0);
    mockDb.waAccountEvent.findFirst.mockResolvedValue(null);
    const out = await getPhoneQualitySummary({ phoneNumberId: 3 });
    expect(out.qualityRating).toBeNull();
    expect(out.lastEventAt).toBeNull();
  });
});
