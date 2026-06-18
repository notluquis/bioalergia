import { beforeEach, describe, expect, it, vi } from "vitest";
import { isDomainError } from "../../lib/errors.ts";

// Unit tests for forwardMessage (server-side message forward). The Cloud API
// has no native forward, so the service re-sends the source content by type
// through the existing send* path; media is re-downloaded from the source
// account + re-uploaded to the target line. We mock the graph client + DB and
// assert the right re-send call + media re-upload happen, plus the type guards.

const { mockDb, graphMock } = vi.hoisted(() => {
  const mockDb = {
    waConversation: { findUnique: vi.fn(), update: vi.fn() },
    waMessage: { findUnique: vi.fn(), create: vi.fn() },
    waPhoneNumber: { findUnique: vi.fn() },
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
    downloadMediaBytes: vi.fn(),
    uploadMedia: vi.fn(),
  };
  return { mockDb, graphMock };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => {
  const noopDb = { $setOptions: () => noopDb };
  return { dbClinicalSeries: noopDb };
});
vi.mock("../../lib/logger.ts", () => ({ logError: vi.fn(), logEvent: vi.fn(), logWarn: vi.fn() }));
vi.mock("../../modules/wa-cloud/graph-client.ts", () => graphMock);
vi.mock("../../modules/wa-cloud/events.ts", () => ({ emitWaEvent: vi.fn() }));

const { forwardMessage } = await import("../wa-messages.ts");

const OPEN = () => new Date(Date.now() - 60_000); // window open

beforeEach(() => {
  vi.clearAllMocks();
  // Target conversation: window open, contact not blocked.
  mockDb.waConversation.findUnique.mockResolvedValue({
    id: 200,
    contactId: 20,
    lastInboundAt: OPEN(),
    contact: { phoneE164: "+56999999999", blockedAt: null },
  });
  mockDb.waConversation.update.mockResolvedValue({});
  mockDb.waMessage.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 999, ...data })
  );
  graphMock.sendTextMessage.mockResolvedValue({ messages: [{ id: "meta-out" }] });
  graphMock.sendMediaMessage.mockResolvedValue({ messages: [{ id: "meta-out" }] });
  graphMock.sendLocationMessage.mockResolvedValue({ messages: [{ id: "meta-out" }] });
  graphMock.sendContactsMessage.mockResolvedValue({ messages: [{ id: "meta-out" }] });
});

const base = { targetConversationId: 200, targetPhoneNumberId: 50 };

describe("forwardMessage", () => {
  it("forwards TEXT by re-sending the body", async () => {
    mockDb.waMessage.findUnique.mockResolvedValue({
      id: 1,
      type: "TEXT",
      body: "hola reenvío",
      phoneNumberId: 9,
      mediaUrl: null,
      mediaCaption: null,
      payload: null,
    });
    await forwardMessage({ sourceMessageId: 1, ...base }, 7);
    expect(graphMock.sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({ body: "hola reenvío", toE164: "+56999999999", phoneNumberId: 50 })
    );
    expect(graphMock.downloadMediaBytes).not.toHaveBeenCalled();
  });

  it("forwards IMAGE by re-downloading from the source account and re-uploading to the target line", async () => {
    mockDb.waMessage.findUnique.mockResolvedValue({
      id: 2,
      type: "IMAGE",
      body: null,
      phoneNumberId: 9,
      mediaUrl: "src-media-id",
      mediaCaption: "una foto",
      payload: null,
    });
    mockDb.waPhoneNumber.findUnique.mockResolvedValue({ accountId: 7 });
    graphMock.downloadMediaBytes.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "image/jpeg",
      sha256: "abc",
    });
    graphMock.uploadMedia.mockResolvedValue({ id: "fresh-id" });

    await forwardMessage({ sourceMessageId: 2, ...base }, 7);

    expect(graphMock.downloadMediaBytes).toHaveBeenCalledWith("src-media-id", 7);
    expect(graphMock.uploadMedia).toHaveBeenCalledOnce();
    expect(graphMock.sendMediaMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "image",
        mediaId: "fresh-id",
        caption: "una foto",
        phoneNumberId: 50,
      })
    );
  });

  it("omits caption when forwarding AUDIO (Meta rejects caption on audio)", async () => {
    mockDb.waMessage.findUnique.mockResolvedValue({
      id: 3,
      type: "AUDIO",
      body: null,
      phoneNumberId: 9,
      mediaUrl: "src-audio-id",
      mediaCaption: "no debería ir",
      payload: null,
    });
    mockDb.waPhoneNumber.findUnique.mockResolvedValue({ accountId: 7 });
    graphMock.downloadMediaBytes.mockResolvedValue({
      bytes: new Uint8Array([9]),
      mimeType: "audio/ogg",
      sha256: "x",
    });
    graphMock.uploadMedia.mockResolvedValue({ id: "fresh-audio" });

    await forwardMessage({ sourceMessageId: 3, ...base }, 7);

    expect(graphMock.sendMediaMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "audio", caption: undefined })
    );
  });

  it("resolves the media id from payload[type].id for outbound media", async () => {
    mockDb.waMessage.findUnique.mockResolvedValue({
      id: 4,
      type: "DOCUMENT",
      body: null,
      phoneNumberId: 9,
      mediaUrl: null,
      mediaCaption: null,
      payload: { document: { id: "outbound-doc-id" } },
    });
    mockDb.waPhoneNumber.findUnique.mockResolvedValue({ accountId: 7 });
    graphMock.downloadMediaBytes.mockResolvedValue({
      bytes: new Uint8Array([5]),
      mimeType: "application/pdf",
      sha256: "y",
    });
    graphMock.uploadMedia.mockResolvedValue({ id: "fresh-doc" });

    await forwardMessage({ sourceMessageId: 4, ...base }, 7);
    expect(graphMock.downloadMediaBytes).toHaveBeenCalledWith("outbound-doc-id", 7);
  });

  it("forwards LOCATION from the stored payload", async () => {
    mockDb.waMessage.findUnique.mockResolvedValue({
      id: 5,
      type: "LOCATION",
      body: null,
      phoneNumberId: 9,
      mediaUrl: null,
      mediaCaption: null,
      payload: { location: { latitude: -33.45, longitude: -70.66, name: "Clínica" } },
    });
    await forwardMessage({ sourceMessageId: 5, ...base }, 7);
    expect(graphMock.sendLocationMessage).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: -33.45, longitude: -70.66, name: "Clínica" })
    );
  });

  it("throws BAD_REQUEST for non-forwardable types", async () => {
    mockDb.waMessage.findUnique.mockResolvedValue({
      id: 6,
      type: "TEMPLATE",
      body: "[plantilla]",
      phoneNumberId: 9,
      mediaUrl: null,
      mediaCaption: null,
      payload: null,
    });
    await expect(forwardMessage({ sourceMessageId: 6, ...base }, 7)).rejects.toSatisfy(
      (e: unknown) => isDomainError(e) && e.kind === "BAD_REQUEST"
    );
  });

  it("throws NOT_FOUND when the source message is missing", async () => {
    mockDb.waMessage.findUnique.mockResolvedValue(null);
    await expect(forwardMessage({ sourceMessageId: 404, ...base }, 7)).rejects.toSatisfy(
      (e: unknown) => isDomainError(e) && e.kind === "NOT_FOUND"
    );
  });
});
