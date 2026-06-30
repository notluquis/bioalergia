// WhatsApp Flows endpoint crypto (Meta data-exchange).
//
// Meta encrypts each request with a fresh AES key that it RSA-OAEP-encrypts to
// OUR registered public key; the body is AES-GCM. We decrypt, process, and
// reply AES-GCM with the SAME key but the IV bit-flipped (Meta's spec). All
// native node:crypto — no deps. The AES key length (16/32 bytes) selects
// AES-128/256-GCM; Meta currently sends 128-bit keys.
//
// Docs: https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/guides/implementingyourflowendpoint

import crypto from "node:crypto";

const GCM_TAG_BYTES = 16;

export type FlowEncryptedRequest = {
  encrypted_aes_key: string;
  encrypted_flow_data: string;
  initial_vector: string;
};

export type FlowRequest = {
  // "ping" (health check), "INIT", "BACK", "data_exchange"
  action?: string;
  screen?: string;
  data?: Record<string, unknown>;
  flow_token?: string;
  version?: string;
};

function gcmAlgo(aesKey: Buffer): "aes-128-gcm" | "aes-256-gcm" {
  if (aesKey.length === 16) return "aes-128-gcm";
  if (aesKey.length === 32) return "aes-256-gcm";
  throw new Error(`Unexpected AES key length ${aesKey.length}`);
}

export function decryptFlowRequest(
  body: FlowEncryptedRequest,
  privateKeyPem: string
): { request: FlowRequest; aesKey: Buffer; iv: Buffer } {
  const aesKey = crypto.privateDecrypt(
    {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(body.encrypted_aes_key, "base64")
  );
  const iv = Buffer.from(body.initial_vector, "base64");
  const flowData = Buffer.from(body.encrypted_flow_data, "base64");
  const tag = flowData.subarray(flowData.length - GCM_TAG_BYTES);
  const ciphertext = flowData.subarray(0, flowData.length - GCM_TAG_BYTES);

  const decipher = crypto.createDecipheriv(gcmAlgo(aesKey), aesKey, iv, {
    authTagLength: GCM_TAG_BYTES,
  });
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return { request: JSON.parse(plain.toString("utf8")) as FlowRequest, aesKey, iv };
}

export function encryptFlowResponse(
  response: Record<string, unknown>,
  aesKey: Buffer,
  iv: Buffer
): string {
  // Meta requires the response IV to be the request IV with every bit flipped.
  const flippedIv = Buffer.from(iv.map((b) => b ^ 0xff));
  const cipher = crypto.createCipheriv(gcmAlgo(aesKey), aesKey, flippedIv, {
    authTagLength: GCM_TAG_BYTES,
  });
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(response), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([encrypted, cipher.getAuthTag()]).toString("base64");
}

/** Generate an RSA-2048 keypair (Meta requires RSA, OAEP-SHA256). One-off setup. */
export function generateFlowKeypair(): { publicKeyPem: string; privateKeyPem: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}
