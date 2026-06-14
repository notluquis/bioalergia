import { beforeEach, describe, expect, it, vi } from "vitest";
import { isDomainError } from "../../lib/errors.ts";

// Characterization tests for the gs26 "handlers finos" extraction of the
// CONVERSATIONS / MESSAGES / CONTACTS families out of orpc/wa-cloud.ts (batch 2).
// They pin the EXACT persisted WaMessage shape, the conversation
// lastMessageAt/preview updates, the 24h-window + blocked-contact guards, the
// NOT_FOUND/BAD_REQUEST DomainError kinds + Spanish messages, and the
// authz-vs-existence ordering invariants the handlers used to enforce inline.
// The graph-client send calls are mocked so we can assert they are invoked with
// the right args (intact) while the DB persistence moves into the service.

const { mockDb, graphMock } = vi.hoisted(() => {
  const mockDb = {
    waConversation: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    waMessage: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    waContact: { update: vi.fn() },
  };
  const graphMock = {
    sendTextMessage: vi.fn(),
    sendTemplateMessage: vi.fn(),
    sendReaction: vi.fn(),
    sendMediaMessage: vi.fn(),
    sendFlowMessage: vi.fn(),
    sendInteractiveListMessage: vi.fn(),
    sendLocationMessage: vi.fn(),
    sendAddressMessage: vi.fn(),
    sendContactsMessage: vi.fn(),
    editTextMessage: vi.fn(),
    markMessageRead: vi.fn(),
    blockUsers: vi.fn(),
    unblockUsers: vi.fn(),
    listBlockedUsers: vi.fn(),
  };
  return { mockDb, graphMock };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => {
  const noopDb = { $setOptions: () => noopDb };
  return { dbClinicalSeries: noopDb };
});
vi.mock("../../lib/logger.ts", () => ({ logError: vi.fn(), logEvent: vi.fn() }));
vi.mock("../../modules/wa-cloud/graph-client.ts", () => graphMock);

const {
  listConversations,
  getConversation,
  updateConversation,
  markConversationRead,
  setConversationMute,
  setConversationTyping,
} = await import("../wa-conversations.ts");
const {
  sendText,
  sendTemplate,
  sendReaction,
  sendMedia,
  sendFlow,
  editText,
  searchMessages,
  listConversationMedia,
} = await import("../wa-messages.ts");
const { updateContact, blockContact, unblockContact, listBlocked } = await import(
  "../wa-contacts.ts"
);

// 24h window helpers
const OPEN = () => new Date(Date.now() - 60_000); // 1 min ago → window open
const CLOSED = () => new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h ago → closed

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Conversations ──────────────────────────────────────────────────────────
describe("listConversations", () => {
  it("arma where con status/assigned/phone/search (insensitive) y mapea channelPhoneNumberIds", async () => {
    mockDb.waConversation.count.mockResolvedValue(2);
    mockDb.waConversation.findMany.mockResolvedValue([
      { id: 1, channels: [{ phoneNumberId: 9 }, { phoneNumberId: 10 }] },
    ]);
    const out = await listConversations({
      status: "OPEN",
      assignedToUserId: 5,
      phoneNumberId: 9,
      search: "ana",
      page: 1,
      pageSize: 20,
    });
    expect(out.total).toBe(2);
    expect(out.page).toBe(1);
    expect(out.items[0]!.channelPhoneNumberIds).toEqual([9, 10]);
    const where = mockDb.waConversation.findMany.mock.calls[0]![0].where;
    expect(where.status).toBe("OPEN");
    expect(where.assignedToUserId).toBe(5);
    expect(where.channels).toEqual({ some: { phoneNumberId: 9 } });
    expect(where.contact.OR[1].name.mode).toBe("insensitive");
    // pagination skip
    expect(mockDb.waConversation.findMany.mock.calls[0]![0].skip).toBe(0);
  });
});

describe("getConversation", () => {
  it("lanza NOT_FOUND con mensaje exacto cuando no existe", async () => {
    mockDb.waConversation.findUnique.mockResolvedValue(null);
    const err = await getConversation(99).catch((e: unknown) => e);
    expect(isDomainError(err)).toBe(true);
    expect((err as { kind: string }).kind).toBe("NOT_FOUND");
    expect((err as Error).message).toBe("Conversación no encontrada");
  });

  it("calcula windowOpen=true y expira a +24h del último inbound", async () => {
    const lastInbound = new Date(Date.now() - 60_000);
    mockDb.waConversation.findUnique.mockResolvedValue({
      id: 1,
      lastInboundAt: lastInbound,
      contact: { id: 3 },
      channels: [{ phoneNumberId: 7, phoneNumber: { label: "Recepción" } }],
    });
    mockDb.waMessage.findMany.mockResolvedValue([]);
    const out = await getConversation(1);
    expect(out.windowOpen).toBe(true);
    expect(out.windowExpiresAt!.getTime()).toBe(lastInbound.getTime() + 24 * 60 * 60 * 1000);
    expect(out.channels).toEqual([{ phoneNumberId: 7, label: "Recepción" }]);
  });

  it("windowOpen=false y windowExpiresAt=null sin inbound previo", async () => {
    mockDb.waConversation.findUnique.mockResolvedValue({
      id: 1,
      lastInboundAt: null,
      contact: { id: 3 },
      channels: [],
    });
    mockDb.waMessage.findMany.mockResolvedValue([]);
    const out = await getConversation(1);
    expect(out.windowOpen).toBe(false);
    expect(out.windowExpiresAt).toBeNull();
  });
});

describe("updateConversation", () => {
  it("solo escribe los campos provistos", async () => {
    mockDb.waConversation.update.mockResolvedValue({});
    await updateConversation({ id: 4, status: "CLOSED", notas: "hola" });
    expect(mockDb.waConversation.update.mock.calls[0]![0]).toEqual({
      where: { id: 4 },
      data: { status: "CLOSED", notas: "hola" },
    });
  });
});

describe("markConversationRead", () => {
  it("avisa a Meta y resetea unreadCount", async () => {
    mockDb.waMessage.findFirst.mockResolvedValue({ metaMessageId: "m1", phoneNumberId: 7 });
    mockDb.waConversation.update.mockResolvedValue({});
    await markConversationRead({ conversationId: 3 });
    expect(graphMock.markMessageRead).toHaveBeenCalledWith(7, "m1");
    expect(mockDb.waConversation.update.mock.calls[0]![0]).toEqual({
      where: { id: 3 },
      data: { unreadCount: 0 },
    });
  });

  it("best-effort: si Meta falla igual resetea el badge", async () => {
    mockDb.waMessage.findFirst.mockResolvedValue({ metaMessageId: "m1", phoneNumberId: 7 });
    graphMock.markMessageRead.mockRejectedValue(new Error("meta down"));
    mockDb.waConversation.update.mockResolvedValue({});
    await markConversationRead({ conversationId: 3 });
    expect(mockDb.waConversation.update).toHaveBeenCalledTimes(1);
  });
});

describe("setConversationMute", () => {
  it("convierte mutedUntil a Date / null", async () => {
    mockDb.waConversation.update.mockResolvedValue({});
    const iso = new Date(Date.now() + 3_600_000).toISOString();
    await setConversationMute({ conversationId: 3, mutedUntil: iso });
    expect(mockDb.waConversation.update.mock.calls[0]![0].data.mutedUntil).toBeInstanceOf(Date);
    await setConversationMute({ conversationId: 3, mutedUntil: null });
    expect(mockDb.waConversation.update.mock.calls[1]![0].data.mutedUntil).toBeNull();
  });
});

describe("setConversationTyping", () => {
  it("manda typing=true sobre el último inbound", async () => {
    mockDb.waMessage.findFirst.mockResolvedValue({ metaMessageId: "m1", phoneNumberId: 7 });
    await setConversationTyping(3);
    expect(graphMock.markMessageRead).toHaveBeenCalledWith(7, "m1", true);
  });
});

// ── Messages (send persistence) ─────────────────────────────────────────────
describe("sendText", () => {
  it("lanza BAD_REQUEST si el contacto está bloqueado, sin llamar a Meta", async () => {
    mockDb.waConversation.findUnique.mockResolvedValue({
      id: 1,
      contactId: 2,
      lastInboundAt: OPEN(),
      contact: { phoneE164: "+569", blockedAt: new Date() },
    });
    const err = await sendText({ conversationId: 1, phoneNumberId: 7, body: "hi" }, 9).catch(
      (e: unknown) => e
    );
    expect((err as { kind: string }).kind).toBe("BAD_REQUEST");
    expect((err as Error).message).toContain("Contacto bloqueado");
    expect(graphMock.sendTextMessage).not.toHaveBeenCalled();
  });

  it("lanza BAD_REQUEST si la ventana 24h está cerrada", async () => {
    mockDb.waConversation.findUnique.mockResolvedValue({
      id: 1,
      contactId: 2,
      lastInboundAt: CLOSED(),
      contact: { phoneE164: "+569", blockedAt: null },
    });
    const err = await sendText({ conversationId: 1, phoneNumberId: 7, body: "hi" }, 9).catch(
      (e: unknown) => e
    );
    expect((err as { kind: string }).kind).toBe("BAD_REQUEST");
    expect((err as Error).message).toContain("Ventana 24h cerrada");
    expect(graphMock.sendTextMessage).not.toHaveBeenCalled();
  });

  it("envía por Meta, persiste WaMessage OUTBOUND/TEXT y actualiza la conversación", async () => {
    mockDb.waConversation.findUnique.mockResolvedValue({
      id: 1,
      contactId: 2,
      lastInboundAt: OPEN(),
      contact: { phoneE164: "+56999", blockedAt: null },
    });
    graphMock.sendTextMessage.mockResolvedValue({ messages: [{ id: "wamid.1" }] });
    mockDb.waMessage.create.mockResolvedValue({ id: 50 });
    mockDb.waConversation.update.mockResolvedValue({});
    const out = await sendText({ conversationId: 1, phoneNumberId: 7, body: "hola mundo" }, 9);
    expect(out).toEqual({ message: { id: 50 } });
    expect(graphMock.sendTextMessage).toHaveBeenCalledWith({
      phoneNumberId: 7,
      toE164: "+56999",
      body: "hola mundo",
      contextMessageId: undefined,
    });
    const data = mockDb.waMessage.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      conversationId: 1,
      contactId: 2,
      phoneNumberId: 7,
      metaMessageId: "wamid.1",
      direction: "OUTBOUND",
      type: "TEXT",
      status: "SENT",
      body: "hola mundo",
      sentByUserId: 9,
    });
    const convUpd = mockDb.waConversation.update.mock.calls[0]![0];
    expect(convUpd.where).toEqual({ id: 1 });
    expect(convUpd.data.lastMessagePreview).toBe("hola mundo");
    expect(convUpd.data.lastMessageAt).toBeInstanceOf(Date);
  });
});

describe("sendTemplate", () => {
  it("NO chequea ventana 24h (plantilla reactiva), bloquea solo si contacto bloqueado", async () => {
    mockDb.waConversation.findUnique.mockResolvedValue({
      id: 1,
      contactId: 2,
      lastInboundAt: CLOSED(), // ventana cerrada NO debe importar
      contact: { phoneE164: "+56999", blockedAt: null },
    });
    graphMock.sendTemplateMessage.mockResolvedValue({ messages: [{ id: "wamid.t" }] });
    mockDb.waMessage.create.mockResolvedValue({ id: 60 });
    mockDb.waConversation.update.mockResolvedValue({});
    const out = await sendTemplate(
      {
        conversationId: 1,
        phoneNumberId: 7,
        templateName: "recordatorio",
        language: "es",
        bodyParams: ["Ana"],
      },
      9
    );
    expect(out).toEqual({ message: { id: 60 } });
    expect(graphMock.sendTemplateMessage).toHaveBeenCalledTimes(1);
    const data = mockDb.waMessage.create.mock.calls[0]![0].data;
    expect(data.type).toBe("TEMPLATE");
    expect(data.body).toBe("[plantilla] recordatorio");
    expect(data.templateName).toBe("recordatorio");
    expect(data.templateLanguage).toBe("es");
    // body component armado
    expect(data.payload.components[0]).toEqual({
      type: "body",
      parameters: [{ type: "text", text: "Ana" }],
    });
  });
});

describe("sendReaction", () => {
  it("no chequea ventana; persiste REACTION con contextMetaMessageId", async () => {
    mockDb.waConversation.findUnique.mockResolvedValue({
      id: 1,
      contactId: 2,
      lastInboundAt: null,
      contact: { phoneE164: "+56999", blockedAt: null },
    });
    graphMock.sendReaction.mockResolvedValue({ messages: [{ id: "wamid.r" }] });
    mockDb.waMessage.create.mockResolvedValue({ id: 70 });
    await sendReaction(
      { conversationId: 1, phoneNumberId: 7, metaMessageId: "wamid.in", emoji: "👍" },
      9
    );
    expect(graphMock.sendReaction).toHaveBeenCalledWith(7, "+56999", "wamid.in", "👍");
    const data = mockDb.waMessage.create.mock.calls[0]![0].data;
    expect(data.type).toBe("REACTION");
    expect(data.contextMetaMessageId).toBe("wamid.in");
    expect(data.body).toBe("👍");
  });
});

describe("sendMedia", () => {
  it("lanza BAD_REQUEST si falta mediaId y link", async () => {
    mockDb.waConversation.findUnique.mockResolvedValue({
      id: 1,
      contactId: 2,
      lastInboundAt: OPEN(),
      contact: { phoneE164: "+569", blockedAt: null },
    });
    const err = await sendMedia({ conversationId: 1, phoneNumberId: 7, type: "image" }, 9).catch(
      (e: unknown) => e
    );
    expect((err as { kind: string }).kind).toBe("BAD_REQUEST");
    expect((err as Error).message).toBe("Falta mediaId o link");
  });

  it("mapea type→enum y persiste con payload", async () => {
    mockDb.waConversation.findUnique.mockResolvedValue({
      id: 1,
      contactId: 2,
      lastInboundAt: OPEN(),
      contact: { phoneE164: "+56999", blockedAt: null },
    });
    graphMock.sendMediaMessage.mockResolvedValue({ messages: [{ id: "wamid.m" }] });
    mockDb.waMessage.create.mockResolvedValue({ id: 80 });
    mockDb.waConversation.update.mockResolvedValue({});
    await sendMedia(
      { conversationId: 1, phoneNumberId: 7, type: "document", mediaId: "med1", filename: "rx.pdf" },
      9
    );
    const data = mockDb.waMessage.create.mock.calls[0]![0].data;
    expect(data.type).toBe("DOCUMENT");
    expect(data.payload.document.id).toBe("med1");
    expect(mockDb.waConversation.update.mock.calls[0]![0].data.lastMessagePreview).toBe("rx.pdf");
  });
});

describe("sendFlow", () => {
  it("requiere ventana abierta", async () => {
    mockDb.waConversation.findUnique.mockResolvedValue({
      id: 1,
      contactId: 2,
      lastInboundAt: CLOSED(),
      contact: { phoneE164: "+569", blockedAt: null },
    });
    const err = await sendFlow(
      { conversationId: 1, phoneNumberId: 7, flowId: "f1", flowCta: "Reservar", bodyText: "b" },
      9
    ).catch((e: unknown) => e);
    expect((err as { kind: string }).kind).toBe("BAD_REQUEST");
    expect(graphMock.sendFlowMessage).not.toHaveBeenCalled();
  });
});

describe("editText", () => {
  it("lanza NOT_FOUND si el mensaje no existe", async () => {
    mockDb.waMessage.findUnique.mockResolvedValue(null);
    const err = await editText({ messageId: 1, phoneNumberId: 7, body: "x" }).catch(
      (e: unknown) => e
    );
    expect((err as { kind: string }).kind).toBe("NOT_FOUND");
    expect((err as Error).message).toBe("Mensaje no encontrado");
  });

  it("rechaza editar mensajes no-texto o inbound", async () => {
    mockDb.waMessage.findUnique.mockResolvedValue({
      id: 1,
      direction: "INBOUND",
      type: "TEXT",
      metaMessageId: "m",
      timestamp: new Date(),
      conversation: { contact: { phoneE164: "+569" } },
    });
    const err = await editText({ messageId: 1, phoneNumberId: 7, body: "x" }).catch(
      (e: unknown) => e
    );
    expect((err as { kind: string }).kind).toBe("BAD_REQUEST");
    expect((err as Error).message).toBe("Solo mensajes de texto enviados son editables");
  });

  it("rechaza si pasaron más de 15 min", async () => {
    mockDb.waMessage.findUnique.mockResolvedValue({
      id: 1,
      direction: "OUTBOUND",
      type: "TEXT",
      metaMessageId: "m",
      timestamp: new Date(Date.now() - 16 * 60 * 1000),
      conversation: { contact: { phoneE164: "+569" } },
    });
    const err = await editText({ messageId: 1, phoneNumberId: 7, body: "x" }).catch(
      (e: unknown) => e
    );
    expect((err as { kind: string }).kind).toBe("BAD_REQUEST");
    expect((err as Error).message).toBe("Ventana de edición (15 min) expirada");
  });

  it("edita en Meta y actualiza el body local", async () => {
    mockDb.waMessage.findUnique.mockResolvedValue({
      id: 1,
      direction: "OUTBOUND",
      type: "TEXT",
      metaMessageId: "m",
      timestamp: new Date(Date.now() - 60_000),
      conversation: { contact: { phoneE164: "+56999" } },
    });
    mockDb.waMessage.update.mockResolvedValue({ id: 1, body: "nuevo" });
    const out = await editText({ messageId: 1, phoneNumberId: 7, body: "nuevo" });
    expect(graphMock.editTextMessage).toHaveBeenCalledWith({
      phoneNumberId: 7,
      toE164: "+56999",
      metaMessageId: "m",
      body: "nuevo",
    });
    expect(out.message).toEqual({ id: 1, body: "nuevo" });
  });
});

describe("searchMessages", () => {
  it("busca insensitive y arma el resultado con contactName fallback", async () => {
    mockDb.waMessage.findMany.mockResolvedValue([
      {
        id: 1,
        conversationId: 2,
        direction: "INBOUND",
        type: "TEXT",
        body: "hola",
        timestamp: new Date(0),
        conversation: { contact: { name: null, pushName: "Ana", phoneE164: "+569" } },
      },
    ]);
    const out = await searchMessages({ q: "hola", limit: 10 });
    expect(mockDb.waMessage.findMany.mock.calls[0]![0].where.body.mode).toBe("insensitive");
    expect(out.results[0]!.contactName).toBe("Ana");
    expect(out.results[0]!.messageId).toBe(1);
  });
});

describe("listConversationMedia", () => {
  it("filtra por tipos de media y marca out=OUTBOUND", async () => {
    mockDb.waMessage.findMany.mockResolvedValue([
      { id: 1, type: "IMAGE", body: null, timestamp: new Date(0), direction: "OUTBOUND" },
    ]);
    const out = await listConversationMedia({ conversationId: 2, limit: 30 });
    expect(mockDb.waMessage.findMany.mock.calls[0]![0].where.type).toEqual({
      in: ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "STICKER"],
    });
    expect(out.media[0]!.out).toBe(true);
  });
});

// ── Contacts ────────────────────────────────────────────────────────────────
describe("updateContact", () => {
  it("solo escribe campos provistos (incluye patientRut)", async () => {
    mockDb.waContact.update.mockResolvedValue({});
    await updateContact({ id: 4, name: "Ana", patientRut: "1-9" });
    expect(mockDb.waContact.update.mock.calls[0]![0]).toEqual({
      where: { id: 4 },
      data: { name: "Ana", patientRut: "1-9" },
    });
  });
});

describe("blockContact", () => {
  it("lanza NOT_FOUND cuando la conversación no existe", async () => {
    mockDb.waConversation.findUnique.mockResolvedValue(null);
    const err = await blockContact({ conversationId: 1, phoneNumberId: 7 }, 9).catch(
      (e: unknown) => e
    );
    expect((err as { kind: string }).kind).toBe("NOT_FOUND");
    expect((err as Error).message).toBe("Conversación no encontrada");
  });

  it("bloquea en Meta, estampa blockedAt+blockedByUserId y archiva la conversación", async () => {
    mockDb.waConversation.findUnique.mockResolvedValue({
      id: 1,
      contactId: 2,
      contact: { phoneE164: "+56999" },
    });
    mockDb.waContact.update.mockResolvedValue({});
    mockDb.waConversation.update.mockResolvedValue({});
    await blockContact({ conversationId: 1, phoneNumberId: 7 }, 9);
    expect(graphMock.blockUsers).toHaveBeenCalledWith(7, ["+56999"]);
    const cu = mockDb.waContact.update.mock.calls[0]![0];
    expect(cu.where).toEqual({ id: 2 });
    expect(cu.data.blockedByUserId).toBe(9);
    expect(cu.data.blockedAt).toBeInstanceOf(Date);
    expect(mockDb.waConversation.update.mock.calls[0]![0]).toEqual({
      where: { id: 1 },
      data: { status: "ARCHIVED" },
    });
  });
});

describe("unblockContact", () => {
  it("desbloquea en Meta, limpia blockedAt y reabre la conversación", async () => {
    mockDb.waConversation.findUnique.mockResolvedValue({
      id: 1,
      contactId: 2,
      contact: { phoneE164: "+56999" },
    });
    mockDb.waContact.update.mockResolvedValue({});
    mockDb.waConversation.update.mockResolvedValue({});
    await unblockContact({ conversationId: 1, phoneNumberId: 7 });
    expect(graphMock.unblockUsers).toHaveBeenCalledWith(7, ["+56999"]);
    expect(mockDb.waContact.update.mock.calls[0]![0].data).toEqual({
      blockedAt: null,
      blockedByUserId: null,
    });
    expect(mockDb.waConversation.update.mock.calls[0]![0]).toEqual({
      where: { id: 1 },
      data: { status: "OPEN" },
    });
  });
});

describe("listBlocked", () => {
  it("normaliza wa_id/input a null", async () => {
    graphMock.listBlockedUsers.mockResolvedValue({
      data: [{ wa_id: "569", input: undefined }, {}],
    });
    const out = await listBlocked({ phoneNumberId: 7 });
    expect(out.blocked).toEqual([
      { wa_id: "569", input: null },
      { wa_id: null, input: null },
    ]);
  });
});
