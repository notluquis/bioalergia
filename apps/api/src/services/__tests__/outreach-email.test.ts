import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock factories are hoisted — keep mock state inside vi.hoisted so the
// db/email mocks can reference it without TDZ errors.
const { mockDb, sendMock, sendersMock } = vi.hoisted(() => {
  const mockDb = {
    outreachEmailCampaign: { findUnique: vi.fn(), update: vi.fn() },
    outreachEmailDelivery: { count: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    outreachInteraction: { create: vi.fn() },
    outreachEstablishment: { update: vi.fn() },
  };
  return { mockDb, sendMock: vi.fn(), sendersMock: vi.fn() };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));
vi.mock("../email/index.ts", () => ({
  getEmailProvider: () => ({ send: sendMock }),
  getEmailSenders: sendersMock,
}));
vi.mock("../../lib/logger.ts", () => ({ logEvent: vi.fn() }));

const { sendOutreachNextBatch } = await import("../outreach-email.ts");

const ENVIANDO = {
  id: 1,
  estado: "ENVIANDO",
  ratePerHour: 50,
  asunto: "Asunto",
  cuerpoHtml: "<p>html</p>",
  cuerpoTexto: "texto",
  fromEmail: "campaign@bioalergia.cl",
  replyTo: null,
};

function delivery(id: number, over: Record<string, unknown> = {}) {
  return {
    id,
    establecimientoRbd: `RBD${id}`,
    contactoId: null,
    emailDestinatario: `dest${id}@x.cl`,
    asuntoRender: null,
    cuerpoHtmlRender: null,
    cuerpoTextoRender: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  sendersMock.mockResolvedValue({
    broadcastFrom: "Bio <noreply@send.bioalergia.cl>",
    replyTo: "r@bioalergia.cl",
  });
  mockDb.outreachEmailCampaign.update.mockResolvedValue({});
  mockDb.outreachEmailDelivery.update.mockImplementation(
    async ({ where }: { where: { id: number } }) => delivery(where.id)
  );
  mockDb.outreachInteraction.create.mockResolvedValue({});
  mockDb.outreachEstablishment.update.mockResolvedValue({});
});

describe("sendOutreachNextBatch", () => {
  it("returns zero + remaining count when campaign not in ENVIANDO state", async () => {
    mockDb.outreachEmailCampaign.findUnique.mockResolvedValue({ ...ENVIANDO, estado: "PAUSADA" });
    mockDb.outreachEmailDelivery.count.mockResolvedValue(7);

    const res = await sendOutreachNextBatch(1, 25);

    expect(res).toEqual({ sent: 0, failed: 0, remaining: 7 });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns zero when missing campaign (remaining=0, no count query)", async () => {
    mockDb.outreachEmailCampaign.findUnique.mockResolvedValue(null);

    const res = await sendOutreachNextBatch(1, 25);

    expect(res).toEqual({ sent: 0, failed: 0, remaining: 0 });
    expect(mockDb.outreachEmailDelivery.count).not.toHaveBeenCalled();
  });

  it("clamps to the per-hour rate cap and sends nothing when cap exhausted", async () => {
    mockDb.outreachEmailCampaign.findUnique.mockResolvedValue({ ...ENVIANDO, ratePerHour: 5 });
    // sentLastHour, then remaining
    mockDb.outreachEmailDelivery.count.mockResolvedValueOnce(5).mockResolvedValueOnce(3);

    const res = await sendOutreachNextBatch(1, 25);

    expect(res).toEqual({ sent: 0, failed: 0, remaining: 3 });
    expect(mockDb.outreachEmailDelivery.findMany).not.toHaveBeenCalled();
  });

  it("sends pending batch, records trail, advances establishment, marks COMPLETADA at zero remaining", async () => {
    mockDb.outreachEmailCampaign.findUnique.mockResolvedValue(ENVIANDO);
    // sentLastHour=0, then remaining=0 after send
    mockDb.outreachEmailDelivery.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    mockDb.outreachEmailDelivery.findMany.mockResolvedValue([delivery(10), delivery(11)]);
    sendMock.mockResolvedValue({ id: "sent" });

    const res = await sendOutreachNextBatch(1, 25);

    expect(res).toEqual({ sent: 2, failed: 0, remaining: 0 });
    expect(sendMock).toHaveBeenCalledTimes(2);
    // from = verified broadcast sender, campaign address preserved as reply-to
    expect(sendMock.mock.calls[0]![0]).toMatchObject({
      from: "Bio <noreply@send.bioalergia.cl>",
      replyTo: "campaign@bioalergia.cl",
      subject: "Asunto",
    });
    expect(mockDb.outreachInteraction.create).toHaveBeenCalledTimes(2);
    expect(mockDb.outreachEstablishment.update).toHaveBeenCalledTimes(2);
    // counter bump + COMPLETADA transition
    expect(mockDb.outreachEmailCampaign.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { enviados: { increment: 2 }, errores: { increment: 0 } },
    });
    expect(mockDb.outreachEmailCampaign.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { estado: "COMPLETADA" },
    });
  });

  it("marks a delivery ERROR when the provider throws, leaving the rest sent", async () => {
    mockDb.outreachEmailCampaign.findUnique.mockResolvedValue(ENVIANDO);
    mockDb.outreachEmailDelivery.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    mockDb.outreachEmailDelivery.findMany.mockResolvedValue([delivery(20), delivery(21)]);
    sendMock.mockResolvedValueOnce({ id: "ok" }).mockRejectedValueOnce(new Error("smtp boom"));

    const res = await sendOutreachNextBatch(1, 25);

    expect(res).toEqual({ sent: 1, failed: 1, remaining: 1 });
    expect(mockDb.outreachEmailDelivery.update).toHaveBeenCalledWith({
      where: { id: 21 },
      data: {
        estado: "ERROR",
        errorMensaje: "smtp boom",
        intentos: { increment: 1 },
      },
    });
    // remaining=1 → no COMPLETADA transition
    expect(mockDb.outreachEmailCampaign.update).not.toHaveBeenCalledWith({
      where: { id: 1 },
      data: { estado: "COMPLETADA" },
    });
  });
});
