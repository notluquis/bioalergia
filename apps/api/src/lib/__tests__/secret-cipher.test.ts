import { describe, expect, it, beforeEach, afterEach } from "vitest";

const ORIG = process.env.WA_SECRET_KEY;
const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("secret-cipher", () => {
  beforeEach(() => {
    process.env.WA_SECRET_KEY = TEST_KEY;
    // bust the module cache so loadKey() re-reads env
    delete require.cache[require.resolve("../secret-cipher.ts")];
  });
  afterEach(() => {
    if (ORIG === undefined) delete process.env.WA_SECRET_KEY;
    else process.env.WA_SECRET_KEY = ORIG;
  });

  it("round-trips", async () => {
    const m = await import("../secret-cipher.ts");
    const enc = m.encryptSecret("super-secret-token");
    expect(enc).toMatch(/^enc:v1:/);
    expect(m.isEncrypted(enc)).toBe(true);
    expect(m.decryptSecret(enc)).toBe("super-secret-token");
  });

  it("returns null for null/undefined", async () => {
    const m = await import("../secret-cipher.ts");
    expect(m.decryptSecret(null)).toBeNull();
    expect(m.decryptSecret(undefined)).toBeNull();
  });

  it("returns plaintext for legacy unprefixed values", async () => {
    const m = await import("../secret-cipher.ts");
    expect(m.decryptSecret("legacy-plain-token")).toBe("legacy-plain-token");
  });

  it("each encryption uses fresh IV", async () => {
    const m = await import("../secret-cipher.ts");
    const a = m.encryptSecret("same");
    const b = m.encryptSecret("same");
    expect(a).not.toBe(b);
    expect(m.decryptSecret(a)).toBe("same");
    expect(m.decryptSecret(b)).toBe("same");
  });

  it("ensureEncrypted is a no-op for already encrypted", async () => {
    const m = await import("../secret-cipher.ts");
    const enc = m.encryptSecret("x");
    expect(m.ensureEncrypted(enc)).toBe(enc);
  });

  it("ensureEncrypted upgrades plaintext", async () => {
    const m = await import("../secret-cipher.ts");
    const upgraded = m.ensureEncrypted("legacy-plain");
    expect(upgraded).toMatch(/^enc:v1:/);
    expect(m.decryptSecret(upgraded)).toBe("legacy-plain");
  });

  it("tampered ciphertext fails authentication", async () => {
    const m = await import("../secret-cipher.ts");
    const enc = m.encryptSecret("hello");
    // flip a byte in the base64 body
    const tampered = enc.slice(0, -3) + (enc.slice(-3, -2) === "A" ? "B" : "A") + enc.slice(-2);
    expect(() => m.decryptSecret(tampered)).toThrow();
  });
});
