import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    intakeSubmission: { findFirst: vi.fn(), create: vi.fn() },
    appointmentPaymentToken: { findUnique: vi.fn() },
    $setOptions: vi.fn(() => mockDb),
  };
  return { mockDb };
});
vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

import { createIntakeFromFlow, mapFlowDataToIntake } from "../intake.ts";

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
