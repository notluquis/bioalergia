import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type FlowPhoto, downloadAndDecryptFlowMedia } from "../flow-media.ts";

// Build a CDN blob the way WhatsApp does: AES-256-CBC(pkcs7) then append the
// first 10 bytes of HMAC-SHA256(iv||ciphertext). Mirror of the decryptor.
function makeEncrypted(plaintext: Buffer): { photo: FlowPhoto; file: Buffer } {
  const cipherKey = crypto.randomBytes(32);
  const macKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", cipherKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const mac = crypto.createHmac("sha256", macKey).update(iv).update(ciphertext).digest().subarray(0, 10);
  const file = Buffer.concat([ciphertext, mac]);
  return {
    file,
    photo: {
      media_id: "m1",
      cdn_url: "https://cdn.example/redacted",
      file_name: "IMG_5237.jpg",
      encryption_metadata: {
        iv: iv.toString("base64"),
        encryption_key: cipherKey.toString("base64"),
        hmac_key: macKey.toString("base64"),
        encrypted_hash: crypto.createHash("sha256").update(file).digest("base64"),
        plaintext_hash: crypto.createHash("sha256").update(plaintext).digest("base64"),
      },
    },
  };
}

function mockFetch(file: Buffer): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(file, { status: 200 }))
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("downloadAndDecryptFlowMedia", () => {
  it("decrypts a valid receipt and derives mime from file name", async () => {
    const plaintext = Buffer.from("fake-jpeg-bytes-of-a-transfer-receipt");
    const { photo, file } = makeEncrypted(plaintext);
    mockFetch(file);
    const out = await downloadAndDecryptFlowMedia(photo);
    expect(out.bytes.equals(plaintext)).toBe(true);
    expect(out.mimeType).toBe("image/jpeg");
    expect(out.fileName).toBe("IMG_5237.jpg");
  });

  it("rejects a tampered ciphertext (HMAC mismatch)", async () => {
    const { photo, file } = makeEncrypted(Buffer.from("hello"));
    file[0] ^= 0xff; // flip a ciphertext byte → encrypted_hash also mismatches first
    mockFetch(file);
    await expect(downloadAndDecryptFlowMedia(photo)).rejects.toThrow(/hash mismatch/);
  });

  it("rejects a wrong hmac_key (HMAC mismatch, hashes intact)", async () => {
    const { photo, file } = makeEncrypted(Buffer.from("hello"));
    photo.encryption_metadata!.hmac_key = crypto.randomBytes(32).toString("base64");
    mockFetch(file);
    await expect(downloadAndDecryptFlowMedia(photo)).rejects.toThrow(/HMAC mismatch/);
  });
});
