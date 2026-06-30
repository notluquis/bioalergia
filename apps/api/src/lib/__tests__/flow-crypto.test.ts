import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decryptFlowRequest,
  encryptFlowResponse,
  generateFlowKeypair,
} from "../flow-crypto.ts";

// Simulate exactly what Meta does when calling our endpoint, then verify our
// decrypt + encrypt round-trips (this is the load-bearing handshake).
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
  return { body: { encrypted_aes_key, encrypted_flow_data, initial_vector: iv.toString("base64") }, aesKey, iv };
}

// Meta decrypts our response with the SAME aes key and the bit-flipped IV.
function metaDecryptResponse(b64: string, aesKey: Buffer, iv: Buffer) {
  const flipped = Buffer.from(iv.map((x) => x ^ 0xff));
  const buf = Buffer.from(b64, "base64");
  const tag = buf.subarray(buf.length - 16);
  const ct = buf.subarray(0, buf.length - 16);
  const d = crypto.createDecipheriv("aes-128-gcm", aesKey, flipped, { authTagLength: 16 });
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(ct), d.final()]).toString("utf8"));
}

describe("flow-crypto", () => {
  it("decrypts a Meta-style request and the round-trips the response", () => {
    const { publicKeyPem, privateKeyPem } = generateFlowKeypair();
    const payload = { action: "INIT", flow_token: "tok_abc", data: { rut: "12345678-9" } };
    const { body, aesKey, iv } = metaEncryptRequest(publicKeyPem, payload);

    const { request, aesKey: gotKey, iv: gotIv } = decryptFlowRequest(body, privateKeyPem);
    expect(request).toEqual(payload);
    expect(gotKey.equals(aesKey)).toBe(true);
    expect(gotIv.equals(iv)).toBe(true);

    const responseObj = { screen: "FICHA", data: { ok: true } };
    const encrypted = encryptFlowResponse(responseObj, gotKey, gotIv);
    expect(metaDecryptResponse(encrypted, aesKey, iv)).toEqual(responseObj);
  });

  it("rejects a tampered ciphertext (GCM auth)", () => {
    const { publicKeyPem, privateKeyPem } = generateFlowKeypair();
    const { body } = metaEncryptRequest(publicKeyPem, { action: "ping" });
    const tampered = Buffer.from(body.encrypted_flow_data, "base64");
    tampered[0] ^= 0xff;
    expect(() =>
      decryptFlowRequest(
        { ...body, encrypted_flow_data: tampered.toString("base64") },
        privateKeyPem
      )
    ).toThrow();
  });
});
