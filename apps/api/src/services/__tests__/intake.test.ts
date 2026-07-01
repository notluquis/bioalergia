import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mocks } = vi.hoisted(() => {
  const mockDb = {
    intakeSubmission: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    appointmentPaymentToken: { findUnique: vi.fn() },
    $setOptions: vi.fn(() => mockDb),
  };
  const mocks = {
    downloadAndDecryptFlowMedia: vi.fn(),
    putR2Object: vi.fn(),
    getR2Object: vi.fn(),
    uploadMedia: vi.fn(),
    loadAbonoStaffNotifyConfig: vi.fn(),
    fanout: vi.fn(),
    appendAbonoFlowHistory: vi.fn(),
    getSetting: vi.fn(),
    ensureContactAndConversation: vi.fn(),
    sendFlow: vi.fn(),
  };
  return { mockDb, mocks };
});
vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));
vi.mock("../../lib/logger.ts", () => ({ logEvent: vi.fn(), logError: vi.fn() }));
vi.mock("../../lib/flow-media.ts", () => ({
  downloadAndDecryptFlowMedia: mocks.downloadAndDecryptFlowMedia,
}));
vi.mock("../../modules/cloudflare/r2.ts", () => ({
  putR2Object: mocks.putR2Object,
  getR2Object: mocks.getR2Object,
}));
vi.mock("../../modules/wa-cloud/graph-client.ts", () => ({ uploadMedia: mocks.uploadMedia }));
vi.mock("../abono-staff-notify.ts", () => ({ fanout: mocks.fanout }));
vi.mock("../../lib/doctoralia/abono-flow-history.ts", () => ({
  appendAbonoFlowHistory: mocks.appendAbonoFlowHistory,
}));
vi.mock("../../lib/settings.ts", () => ({ getSetting: mocks.getSetting }));
vi.mock("../wa-contacts.ts", () => ({
  ensureContactAndConversation: mocks.ensureContactAndConversation,
}));
vi.mock("../wa-messages.ts", () => ({ sendFlow: mocks.sendFlow }));
vi.mock("../../lib/doctoralia/abono-whatsapp-settings.ts", async (importActual) => {
  const actual = await importActual<typeof AbonoWaSettingsModule>();
  return { ...actual, loadAbonoStaffNotifyConfig: mocks.loadAbonoStaffNotifyConfig };
});

import type * as AbonoWaSettingsModule from "../../lib/doctoralia/abono-whatsapp-settings.ts";
import {
  ABONO_WHATSAPP_SETTINGS,
  WA_FLOW_SETTINGS,
} from "../../lib/doctoralia/abono-whatsapp-settings.ts";
import {
  createIntakeFromFlow,
  listIntakeSubmissions,
  mapFlowDataToIntake,
  notifyStaffFicha,
  processIntakeReceipt,
  sendIntakeFlow,
} from "../intake.ts";

describe("mapFlowDataToIntake", () => {
  it("maps flow fields + normalizes a valid RUT + parses insurance/minor", () => {
    const out = mapFlowDataToIntake(
      {
        nombre: "Juan Pérez",
        rut: "12.345.678-5",
        correo: "j@x.cl",
        prevision: "isapre",
        isapre: "Colmena",
        direccion: "Calle 1",
        motivo: "alergia",
        alergias: "polen",
        condiciones: "asma",
        es_menor: "no",
        telefono: "+56999",
      },
      { patientName: "Fallback", patientPhone: "+56900" }
    );
    expect(out.patientName).toBe("Juan Pérez");
    expect(out.patientPhone).toBe("+56999");
    expect(out.patientRut).toBe("12345678-5"); // normalized
    expect(out.healthInsurance).toBe("ISAPRE");
    expect(out.isapreName).toBe("Colmena");
    expect(out.isMinor).toBe(false);
    expect(out.knownAllergies).toBe("polen");
  });

  it("keeps an invalid RUT raw (staff verify) + falls back to token name/phone", () => {
    const out = mapFlowDataToIntake(
      { rut: "99999999-9" },
      {
        patientName: "Token Name",
        patientPhone: "+56911",
      }
    );
    expect(out.patientRut).toBe("99999999-9"); // invalid mod-11 → kept raw
    expect(out.patientName).toBe("Token Name");
    expect(out.patientPhone).toBe("+56911");
    expect(out.healthInsurance).toBeNull();
  });

  it("parses a DatePicker epoch-ms birthDate", () => {
    const ms = Date.UTC(2015, 0, 15);
    const out = mapFlowDataToIntake({ fecha_nacimiento: String(ms) }, {});
    expect(out.patientBirthDate?.getTime()).toBe(ms);
    expect(out.isMinor).toBeNull();
  });
});

describe("createIntakeFromFlow — media secret redaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.intakeSubmission.findFirst.mockResolvedValue(null);
    mockDb.appointmentPaymentToken.findUnique.mockResolvedValue(null);
  });

  it("strips encryption keys + cdn_url from persisted raw but keeps form fields + media_id", async () => {
    let capturedRaw: unknown;
    mockDb.intakeSubmission.create.mockImplementation(
      async ({ data }: { data: { raw: unknown } }) => {
        capturedRaw = data.raw;
        return { id: "intake_1" };
      }
    );

    const data = {
      nombre: "Juan Pérez",
      telefono: "+56999",
      comprobante: [
        {
          media_id: "MID-123",
          file_name: "boleta.jpg",
          cdn_url: "https://cdn.example/signed-transient",
          encryption_metadata: {
            encrypted_hash: "eh==",
            iv: "iv==",
            encryption_key: "SECRET_ENCRYPTION_KEY",
            hmac_key: "SECRET_HMAC_KEY",
            plaintext_hash: "ph==",
          },
        },
      ],
    };

    const res = await createIntakeFromFlow("tok-1", data);
    expect(res).toEqual({ id: "intake_1", isNew: true });

    const serialized = JSON.stringify(capturedRaw);
    expect(serialized).not.toContain("SECRET_ENCRYPTION_KEY");
    expect(serialized).not.toContain("SECRET_HMAC_KEY");
    expect(serialized).not.toContain("cdn.example");

    const raw = capturedRaw as {
      nombre: string;
      comprobante: {
        media_id?: string;
        file_name?: string;
        encryption_metadata?: unknown;
        cdn_url?: string;
      }[];
    };
    expect(raw.nombre).toBe("Juan Pérez"); // form fields retained
    expect(raw.comprobante[0]?.media_id).toBe("MID-123"); // audit-useful
    expect(raw.comprobante[0]?.file_name).toBe("boleta.jpg");
    expect(raw.comprobante[0]?.encryption_metadata).toBeUndefined();
    expect(raw.comprobante[0]?.cdn_url).toBeUndefined();

    // Original in-memory payload MUST keep the real keys (processIntakeReceipt
    // reads `data` directly, not the stored `raw`).
    expect(data.comprobante[0]?.encryption_metadata.encryption_key).toBe("SECRET_ENCRYPTION_KEY");
    expect(data.comprobante[0]?.cdn_url).toBe("https://cdn.example/signed-transient");
  });
});

describe("createIntakeFromFlow — dedup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.appointmentPaymentToken.findUnique.mockResolvedValue(null);
  });

  it("returns the existing row (isNew:false) + skips create when the flowToken already exists", async () => {
    mockDb.intakeSubmission.findFirst.mockResolvedValue({ id: "intake_existing" });

    const res = await createIntakeFromFlow("tok-dup", { nombre: "Ana" });

    expect(res).toEqual({ id: "intake_existing", isNew: false });
    expect(mockDb.intakeSubmission.create).not.toHaveBeenCalled();
  });

  it("recovers the winning row when create races a concurrent insert (unique violation)", async () => {
    // First findFirst (pre-check) sees nothing; create loses the race; the catch
    // findFirst recovers the row the concurrent request inserted.
    mockDb.intakeSubmission.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "intake_winner" });
    mockDb.intakeSubmission.create.mockRejectedValue(new Error("unique_violation flow_token"));

    const res = await createIntakeFromFlow("tok-race", { nombre: "Ana" });

    expect(res).toEqual({ id: "intake_winner", isNew: false });
    expect(mockDb.intakeSubmission.findFirst).toHaveBeenCalledTimes(2);
  });

  it("re-throws when create fails and no winning row is found (real error)", async () => {
    mockDb.intakeSubmission.findFirst.mockResolvedValue(null); // both checks empty
    mockDb.intakeSubmission.create.mockRejectedValue(new Error("db down"));

    await expect(createIntakeFromFlow("tok-x", { nombre: "Ana" })).rejects.toThrow("db down");
  });
});

describe("processIntakeReceipt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const photoData = {
    nombre: "Ana",
    comprobante: [
      {
        media_id: "MID-9",
        file_name: "boleta.jpg",
        cdn_url: "https://cdn.example/blob",
        encryption_metadata: { encryption_key: "k", hmac_key: "h", iv: "iv", encrypted_hash: "e" },
      },
    ],
  };

  it("returns early (no download/upload) when there is no photo in the data", async () => {
    await processIntakeReceipt("intake_1", { nombre: "Ana" });

    expect(mocks.downloadAndDecryptFlowMedia).not.toHaveBeenCalled();
    expect(mocks.putR2Object).not.toHaveBeenCalled();
    expect(mockDb.intakeSubmission.update).not.toHaveBeenCalled();
  });

  it("downloads+decrypts → uploads to R2 under intake-comprobante/<id> → updates the row", async () => {
    const bytes = Buffer.from("decrypted");
    mocks.downloadAndDecryptFlowMedia.mockResolvedValue({ bytes, mimeType: "image/jpeg" });
    mocks.putR2Object.mockResolvedValue(undefined);
    mockDb.intakeSubmission.update.mockResolvedValue({});

    await processIntakeReceipt("intake_42", photoData);

    expect(mocks.putR2Object).toHaveBeenCalledWith("intake-comprobante/intake_42", bytes, "image/jpeg");
    expect(mockDb.intakeSubmission.update).toHaveBeenCalledWith({
      where: { id: "intake_42" },
      data: { comprobanteR2Key: "intake-comprobante/intake_42", comprobanteMime: "image/jpeg" },
    });
  });

  it("swallows a decrypt/verify failure (best-effort) — never throws, no row update", async () => {
    mocks.downloadAndDecryptFlowMedia.mockRejectedValue(new Error("HMAC mismatch"));

    await expect(processIntakeReceipt("intake_bad", photoData)).resolves.toBeUndefined();
    expect(mocks.putR2Object).not.toHaveBeenCalled();
    expect(mockDb.intakeSubmission.update).not.toHaveBeenCalled();
  });
});

describe("notifyStaffFicha", () => {
  const enabledCfg = {
    enabled: true,
    phones: ["+56999999999"],
    fichaTemplateName: "ficha_tpl",
    cardTemplateName: null,
    comprobanteTemplateName: null,
    language: "es",
    phoneNumberId: 111,
  };

  function intakeRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "intake_1",
      patientName: "Ana Díaz",
      patientRut: "12345678-5",
      patientEmail: null,
      patientBirthDate: null,
      healthInsurance: null,
      isapreName: null,
      address: null,
      reason: null,
      knownAllergies: null,
      conditions: null,
      medications: null,
      isMinor: null,
      guardianName: null,
      guardianRut: null,
      guardianPhone: null,
      comprobanteR2Key: null, // skip the IMAGE-header re-upload path
      comprobanteMime: null,
      appointmentPaymentToken: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.appendAbonoFlowHistory.mockResolvedValue(undefined);
    mockDb.intakeSubmission.update.mockResolvedValue({});
  });

  it("returns early when staff-notify is disabled", async () => {
    mocks.loadAbonoStaffNotifyConfig.mockResolvedValue({ ...enabledCfg, enabled: false });
    await notifyStaffFicha("intake_1");
    expect(mockDb.intakeSubmission.findUnique).not.toHaveBeenCalled();
    expect(mocks.fanout).not.toHaveBeenCalled();
  });

  it("returns early when there are no staff phones", async () => {
    mocks.loadAbonoStaffNotifyConfig.mockResolvedValue({ ...enabledCfg, phones: [] });
    await notifyStaffFicha("intake_1");
    expect(mocks.fanout).not.toHaveBeenCalled();
  });

  it("returns early when the ficha template isn't configured", async () => {
    mocks.loadAbonoStaffNotifyConfig.mockResolvedValue({ ...enabledCfg, fichaTemplateName: null });
    await notifyStaffFicha("intake_1");
    expect(mocks.fanout).not.toHaveBeenCalled();
  });

  it("does NOT mark staffNotifiedAt when fanout delivered 0 (leave retryable)", async () => {
    mocks.loadAbonoStaffNotifyConfig.mockResolvedValue(enabledCfg);
    mockDb.intakeSubmission.findUnique.mockResolvedValue(intakeRow());
    mocks.fanout.mockResolvedValue(0);

    await notifyStaffFicha("intake_1");

    expect(mockDb.intakeSubmission.update).not.toHaveBeenCalled();
  });

  it("marks staffNotifiedAt when fanout delivered ≥1", async () => {
    mocks.loadAbonoStaffNotifyConfig.mockResolvedValue(enabledCfg);
    mockDb.intakeSubmission.findUnique.mockResolvedValue(intakeRow());
    mocks.fanout.mockResolvedValue(2);

    await notifyStaffFicha("intake_1");

    expect(mockDb.intakeSubmission.update).toHaveBeenCalledTimes(1);
    const arg = mockDb.intakeSubmission.update.mock.calls[0]?.[0] as {
      data: { staffNotifiedAt?: Date };
    };
    expect(arg.data.staffNotifiedAt).toBeInstanceOf(Date);
  });

  it("formats birthDate from its UTC calendar day (not Chile-local)", async () => {
    mocks.loadAbonoStaffNotifyConfig.mockResolvedValue(enabledCfg);
    // UTC midnight Jan 15 2015 → in Santiago (UTC-3) that's Jan 14 21:00. The
    // @db.Date must read the UTC day: 15/1/2015, NOT 14.
    mockDb.intakeSubmission.findUnique.mockResolvedValue(
      intakeRow({ patientBirthDate: new Date("2015-01-15T00:00:00.000Z") })
    );
    mocks.fanout.mockResolvedValue(1);

    await notifyStaffFicha("intake_1");

    const params = mocks.fanout.mock.calls[0]?.[2] as Array<{ name: string; text: string }>;
    const detalle = params.find((p) => p.name === "detalle")?.text ?? "";
    expect(detalle).toContain("Nac: 15/1/2015");
  });

  it("collapses newlines/whitespace in TextArea fields (Meta rejects newline params)", async () => {
    mocks.loadAbonoStaffNotifyConfig.mockResolvedValue(enabledCfg);
    mockDb.intakeSubmission.findUnique.mockResolvedValue(
      intakeRow({ reason: "linea1\n\nlinea2   con   espacios" })
    );
    mocks.fanout.mockResolvedValue(1);

    await notifyStaffFicha("intake_1");

    const params = mocks.fanout.mock.calls[0]?.[2] as Array<{ name: string; text: string }>;
    const detalle = params.find((p) => p.name === "detalle")?.text ?? "";
    expect(detalle).not.toContain("\n");
    expect(detalle).toContain("Motivo: linea1 linea2 con espacios");
  });
});

describe("sendIntakeFlow", () => {
  const flowId = "wa.flow.intakeFlowId";
  const bodyText = "wa.flow.intakeBodyText";
  const phoneId = "doctoralia.abono.whatsapp.phoneNumberId";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.appendAbonoFlowHistory.mockResolvedValue(undefined);
    mocks.sendFlow.mockResolvedValue(undefined);
    mocks.ensureContactAndConversation.mockResolvedValue({ conversationId: 7 });
  });

  function settings(map: Record<string, string | null>) {
    mocks.getSetting.mockImplementation(async (key: string) => map[key] ?? null);
  }

  it("keys the getSetting stub against the real settings module", () => {
    expect(WA_FLOW_SETTINGS.intakeFlowId).toBe(flowId);
    expect(ABONO_WHATSAPP_SETTINGS.phoneNumberId).toBe(phoneId);
  });

  const futureToken = (extra: Record<string, unknown> = {}) => ({
    id: "tok-1",
    status: "PENDING",
    expiresAt: new Date(Date.now() + 60_000),
    patientName: "Ana",
    patientPhone: "+56999",
    flowHistory: [],
    ...extra,
  });

  it("skips (no send) when the intake Flow id isn't configured", async () => {
    settings({ [flowId]: null, [bodyText]: null, [phoneId]: "111" });
    await sendIntakeFlow("tok-1");
    expect(mockDb.appointmentPaymentToken.findUnique).not.toHaveBeenCalled();
    expect(mocks.sendFlow).not.toHaveBeenCalled();
  });

  it("skips when the token is no longer PENDING", async () => {
    settings({ [flowId]: "F1", [bodyText]: "hi", [phoneId]: "111" });
    mockDb.appointmentPaymentToken.findUnique.mockResolvedValue(
      futureToken({ status: "EXPIRED" })
    );
    await sendIntakeFlow("tok-1");
    expect(mocks.sendFlow).not.toHaveBeenCalled();
  });

  it("skips when the token is past its expiry", async () => {
    settings({ [flowId]: "F1", [bodyText]: "hi", [phoneId]: "111" });
    mockDb.appointmentPaymentToken.findUnique.mockResolvedValue(
      futureToken({ expiresAt: new Date(Date.now() - 1000) })
    );
    await sendIntakeFlow("tok-1");
    expect(mocks.sendFlow).not.toHaveBeenCalled();
  });

  it("skips when the Flow was already sent (idempotency marker present)", async () => {
    settings({ [flowId]: "F1", [bodyText]: "hi", [phoneId]: "111" });
    mockDb.appointmentPaymentToken.findUnique.mockResolvedValue(
      futureToken({ flowHistory: [{ step: "intake_flow_sent" }] })
    );
    await sendIntakeFlow("tok-1");
    expect(mocks.ensureContactAndConversation).not.toHaveBeenCalled();
    expect(mocks.sendFlow).not.toHaveBeenCalled();
  });

  it("sends the Flow on the FICHA screen with the flow_token, then appends the marker", async () => {
    settings({ [flowId]: "F1", [bodyText]: "Completa tu ficha", [phoneId]: "111" });
    mockDb.appointmentPaymentToken.findUnique.mockResolvedValue(futureToken());

    await sendIntakeFlow("tok-1");

    expect(mocks.sendFlow).toHaveBeenCalledTimes(1);
    const [opts] = mocks.sendFlow.mock.calls[0] as [Record<string, unknown>, unknown];
    expect(opts).toMatchObject({
      flowId: "F1",
      flowToken: "tok-1",
      initialScreen: "FICHA",
      initialData: { nombre: "Ana", telefono: "+56999" },
    });
    expect(mocks.appendAbonoFlowHistory).toHaveBeenCalledWith("tok-1", "intake_flow_sent", {});
  });
});

describe("listIntakeSubmissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function row(id: string, overrides: Record<string, unknown> = {}) {
    return {
      id,
      patientName: "Ana",
      patientPhone: "+56999",
      patientRut: null,
      patientEmail: null,
      healthInsurance: null,
      isapreName: null,
      reason: null,
      isMinor: null,
      appointmentPaymentToken: null,
      comprobanteR2Key: null,
      staffNotifiedAt: null,
      submittedAt: new Date("2026-01-01T00:00:00Z"),
      ...overrides,
    };
  }

  it("applies skip/take pagination and derives the authenticated comprobante url", async () => {
    mockDb.intakeSubmission.findMany.mockResolvedValue([
      row("a", { comprobanteR2Key: "intake-comprobante/a" }),
      row("b"),
    ]);
    mockDb.intakeSubmission.count.mockResolvedValue(25);

    const res = await listIntakeSubmissions({ page: 1, pageSize: 10 });

    const findManyArg = mockDb.intakeSubmission.findMany.mock.calls[0]?.[0] as {
      skip: number;
      take: number;
    };
    expect(findManyArg.skip).toBe(10); // page(1) * pageSize(10)
    expect(findManyArg.take).toBe(10);
    expect(res.total).toBe(25);
    expect(res.items[0]?.comprobanteUrl).toBe("/api/intake-media/comprobante/a");
    expect(res.items[1]?.comprobanteUrl).toBeNull();
  });
});
