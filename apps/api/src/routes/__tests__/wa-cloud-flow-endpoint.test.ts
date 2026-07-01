import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// End-to-end round-trip of the WhatsApp Flows data-exchange endpoint using a
// REAL RSA keypair (no Meta needed). We simulate exactly what Meta posts
// (RSA-OAEP-wrapped AES key + AES-GCM body) and decrypt the endpoint's reply
// with the same key + bit-flipped IV, then assert the orchestration.

const { mockDb, getSetting, createIntakeFromFlow, processIntakeReceipt, notifyStaffFicha } =
  vi.hoisted(() => {
    const mockDb = {
      appointmentPaymentToken: { findUnique: vi.fn() },
      $setOptions: vi.fn(() => mockDb),
    };
    return {
      mockDb,
      getSetting: vi.fn(),
      createIntakeFromFlow: vi.fn(),
      processIntakeReceipt: vi.fn(),
      notifyStaffFicha: vi.fn(),
    };
  });

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));
vi.mock("../../lib/settings.ts", () => ({ getSetting }));
vi.mock("../../lib/logger.ts", () => ({ logEvent: vi.fn(), logError: vi.fn() }));
vi.mock("../../services/intake.ts", () => ({
  createIntakeFromFlow,
  processIntakeReceipt,
  notifyStaffFicha,
}));

import { generateFlowKeypair } from "../../lib/flow-crypto.ts";
import { _resetSecretCipherKeysForTest, encryptSecret } from "../../lib/secret-cipher.ts";
import { waCloudFlowRoutes } from "../wa-cloud-flow-endpoint.ts";

// --- Meta simulation (mirrors lib/__tests__/flow-crypto.test.ts) -------------
function metaEncryptRequest(publicKeyPem: string, payload: object) {
  const aesKey = crypto.randomBytes(16); // Meta uses a 128-bit AES key
  const iv = crypto.randomBytes(16);
  const encrypted_aes_key = crypto
    .publicEncrypt(
      { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
      aesKey
    )
    .toString("base64");
  const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, iv, { authTagLength: 16 });
  const enc = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const encrypted_flow_data = Buffer.concat([enc, cipher.getAuthTag()]).toString("base64");
  return {
    body: {
      encrypted_aes_key,
      encrypted_flow_data,
      initial_vector: iv.toString("base64"),
    },
    aesKey,
    iv,
  };
}

function metaDecryptResponse(b64: string, aesKey: Buffer, iv: Buffer): Record<string, unknown> {
  const flipped = Buffer.from(iv.map((x) => x ^ 0xff));
  const buf = Buffer.from(b64, "base64");
  const tag = buf.subarray(buf.length - 16);
  const ct = buf.subarray(0, buf.length - 16);
  const d = crypto.createDecipheriv("aes-128-gcm", aesKey, flipped, { authTagLength: 16 });
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(ct), d.final()]).toString("utf8"));
}

function post(body: unknown) {
  return waCloudFlowRoutes.request("/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

let publicKeyPem: string;
let encPrivateKey: string;
const prevKey = process.env.WA_SECRET_KEY;

beforeAll(() => {
  process.env.WA_SECRET_KEY = crypto.randomBytes(32).toString("hex");
  _resetSecretCipherKeysForTest();
  const kp = generateFlowKeypair();
  publicKeyPem = kp.publicKeyPem;
  // Persisted exactly as production stores it: encryptSecret(PEM). loadPrivateKey
  // round-trips via decryptSecret.
  encPrivateKey = encryptSecret(kp.privateKeyPem);
});

afterAll(() => {
  process.env.WA_SECRET_KEY = prevKey;
  _resetSecretCipherKeysForTest();
});

beforeEach(() => {
  vi.clearAllMocks();
  getSetting.mockResolvedValue(encPrivateKey);
  processIntakeReceipt.mockResolvedValue(undefined);
  notifyStaffFicha.mockResolvedValue(undefined);
  mockDb.appointmentPaymentToken.findUnique.mockResolvedValue(null);
});

describe("waCloudFlowRoutes — encrypted round-trip", () => {
  it("ping → { status: active }, echoing the request version", async () => {
    const { body, aesKey, iv } = metaEncryptRequest(publicKeyPem, {
      action: "ping",
      version: "3.0",
    });
    const res = await post(body);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const decoded = metaDecryptResponse(await res.text(), aesKey, iv);
    expect(decoded).toEqual({ version: "3.0", data: { status: "active" } });
  });

  it("data_exchange with a fresh PENDING token → creates intake + SUCCESS screen", async () => {
    mockDb.appointmentPaymentToken.findUnique.mockResolvedValue({
      status: "PENDING",
      expiresAt: new Date(Date.now() + 60_000),
    });
    createIntakeFromFlow.mockResolvedValue({ id: "intake_1", isNew: true });

    const data = { nombre: "Juan", rut: "12345678-5" };
    const { body, aesKey, iv } = metaEncryptRequest(publicKeyPem, {
      action: "data_exchange",
      version: "3.0",
      flow_token: "tok-1",
      data,
    });
    const res = await post(body);
    expect(res.status).toBe(200);
    const decoded = metaDecryptResponse(await res.text(), aesKey, iv);
    expect(decoded).toEqual({
      version: "3.0",
      screen: "SUCCESS",
      data: { extension_message_response: { params: { flow_token: "tok-1" } } },
    });
    expect(createIntakeFromFlow).toHaveBeenCalledWith("tok-1", data);
    // Background receipt processing is fired (isNew) — proves the orchestration.
    expect(processIntakeReceipt).toHaveBeenCalledWith("intake_1", data);
  });

  it("data_exchange with an expired token → COMPROBANTE error, no intake created", async () => {
    mockDb.appointmentPaymentToken.findUnique.mockResolvedValue({
      status: "PENDING",
      expiresAt: new Date(Date.now() - 60_000), // past expiry
    });
    const { body, aesKey, iv } = metaEncryptRequest(publicKeyPem, {
      action: "data_exchange",
      version: "3.0",
      flow_token: "tok-expired",
      data: { nombre: "Late" },
    });
    const res = await post(body);
    expect(res.status).toBe(200);
    const decoded = metaDecryptResponse(await res.text(), aesKey, iv) as {
      screen: string;
      data: { error_message?: string };
    };
    expect(decoded.screen).toBe("COMPROBANTE");
    expect(decoded.data.error_message).toMatch(/expiró|procesado/);
    expect(createIntakeFromFlow).not.toHaveBeenCalled();
  });

  it("data_exchange with a non-PENDING token → COMPROBANTE error, no intake created", async () => {
    mockDb.appointmentPaymentToken.findUnique.mockResolvedValue({
      status: "PAID",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const { body, aesKey, iv } = metaEncryptRequest(publicKeyPem, {
      action: "data_exchange",
      version: "3.0",
      flow_token: "tok-paid",
      data: { nombre: "Dup" },
    });
    const res = await post(body);
    const decoded = metaDecryptResponse(await res.text(), aesKey, iv) as { screen: string };
    expect(decoded.screen).toBe("COMPROBANTE");
    expect(createIntakeFromFlow).not.toHaveBeenCalled();
  });

  it("data.error notification → acknowledged", async () => {
    const { body, aesKey, iv } = metaEncryptRequest(publicKeyPem, {
      action: "data_exchange",
      version: "3.0",
      data: { error: { code: 123, message: "client boom" } },
    });
    const res = await post(body);
    const decoded = metaDecryptResponse(await res.text(), aesKey, iv);
    expect(decoded).toEqual({ version: "3.0", data: { acknowledged: true } });
    expect(createIntakeFromFlow).not.toHaveBeenCalled();
  });

  it("missing body fields → 400", async () => {
    const res = await post({ encrypted_aes_key: "x" }); // no flow_data / iv
    expect(res.status).toBe(400);
  });

  it("undecryptable body → 421 (Meta re-fetches public key + retries)", async () => {
    const res = await post({
      encrypted_aes_key: Buffer.from("garbage").toString("base64"),
      encrypted_flow_data: Buffer.from("garbage").toString("base64"),
      initial_vector: Buffer.from("0123456789abcdef").toString("base64"),
    });
    expect(res.status).toBe(421);
  });

  it("no private key setting → 500", async () => {
    getSetting.mockResolvedValue(null);
    const { body } = metaEncryptRequest(publicKeyPem, { action: "ping", version: "3.0" });
    const res = await post(body);
    expect(res.status).toBe(500);
  });
});
