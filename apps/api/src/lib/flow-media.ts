// Download + decrypt media a patient uploaded via a Flow PhotoPicker.
//
// The Flow data_exchange payload carries each photo as a ref to the WhatsApp CDN
// plus its encryption_metadata (AES-256-CBC + HMAC-SHA256 + pkcs7, keys given
// explicitly — no HKDF). The CDN blob is `ciphertext || mac[10]`. We download it,
// verify SHA256 == encrypted_hash, validate the 10-byte HMAC over iv||ciphertext,
// AES-CBC decrypt, then verify SHA256(plaintext) == plaintext_hash. Any mismatch
// throws — we never trust an unverified receipt.

import crypto from "node:crypto";

export type FlowPhoto = {
  media_id?: string;
  cdn_url?: string;
  file_name?: string;
  encryption_metadata?: {
    encrypted_hash?: string;
    iv?: string;
    encryption_key?: string;
    hmac_key?: string;
    plaintext_hash?: string;
  };
};

export type DecryptedFlowMedia = { bytes: Buffer; fileName: string; mimeType: string };

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  heic: "image/heic",
};

function mimeFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

/** Fetch + decrypt + validate one PhotoPicker photo. Throws on any hash/HMAC
 * mismatch or missing field. */
export async function downloadAndDecryptFlowMedia(photo: FlowPhoto): Promise<DecryptedFlowMedia> {
  const m = photo.encryption_metadata;
  if (!photo.cdn_url || !m?.iv || !m.encryption_key || !m.hmac_key || !m.encrypted_hash) {
    throw new Error("flow media: missing cdn_url or encryption_metadata");
  }
  const iv = Buffer.from(m.iv, "base64");
  const cipherKey = Buffer.from(m.encryption_key, "base64");
  const macKey = Buffer.from(m.hmac_key, "base64");
  const encryptedHash = Buffer.from(m.encrypted_hash, "base64");

  const res = await fetch(photo.cdn_url);
  if (!res.ok) throw new Error(`flow media: CDN fetch ${res.status}`);
  const file = Buffer.from(await res.arrayBuffer());

  // Whole downloaded file hash.
  if (!crypto.timingSafeEqual(crypto.createHash("sha256").update(file).digest(), encryptedHash)) {
    throw new Error("flow media: encrypted_hash mismatch");
  }

  // Split ciphertext || mac[10] and validate HMAC over iv||ciphertext.
  const ciphertext = file.subarray(0, file.length - 10);
  const mac = file.subarray(file.length - 10);
  const expectedMac = crypto
    .createHmac("sha256", macKey)
    .update(iv)
    .update(ciphertext)
    .digest()
    .subarray(0, 10);
  if (!crypto.timingSafeEqual(mac, expectedMac)) {
    throw new Error("flow media: HMAC mismatch");
  }

  const decipher = crypto.createDecipheriv("aes-256-cbc", cipherKey, iv);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  // Optional but cheap: verify the decrypted bytes against plaintext_hash.
  if (m.plaintext_hash) {
    const ph = Buffer.from(m.plaintext_hash, "base64");
    if (!crypto.timingSafeEqual(crypto.createHash("sha256").update(plaintext).digest(), ph)) {
      throw new Error("flow media: plaintext_hash mismatch");
    }
  }

  const fileName = photo.file_name?.trim() || `${photo.media_id ?? "comprobante"}.jpg`;
  return { bytes: plaintext, fileName, mimeType: mimeFromName(fileName) };
}
