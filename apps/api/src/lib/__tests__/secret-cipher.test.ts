import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  _resetSecretCipherKeysForTest,
  decryptSecret,
  encryptSecret,
  ensureEncrypted,
  isEncrypted,
  keyIdOf,
} from "../secret-cipher.ts";

const ORIG_KEY = process.env.WA_SECRET_KEY;
const ORIG_OLD = process.env.WA_SECRET_KEYS_OLD;
const KEY_A = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const KEY_B = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

describe("secret-cipher", () => {
  beforeEach(() => {
    process.env.WA_SECRET_KEY = KEY_A;
    delete process.env.WA_SECRET_KEYS_OLD;
    _resetSecretCipherKeysForTest();
  });
  afterEach(() => {
    if (ORIG_KEY === undefined) delete process.env.WA_SECRET_KEY;
    else process.env.WA_SECRET_KEY = ORIG_KEY;
    if (ORIG_OLD === undefined) delete process.env.WA_SECRET_KEYS_OLD;
    else process.env.WA_SECRET_KEYS_OLD = ORIG_OLD;
    _resetSecretCipherKeysForTest();
  });

  it("round-trips with v2 prefix + key id", () => {
    const enc = encryptSecret("super-secret-token");
    expect(enc).toMatch(/^enc:v2:[0-9a-f]{8}:/);
    expect(isEncrypted(enc)).toBe(true);
    expect(keyIdOf(enc)).toMatch(/^[0-9a-f]{8}$/);
    expect(decryptSecret(enc)).toBe("super-secret-token");
  });

  it("returns null for null/undefined", () => {
    expect(decryptSecret(null)).toBeNull();
    expect(decryptSecret(undefined)).toBeNull();
  });

  it("returns plaintext for legacy unprefixed values", () => {
    expect(decryptSecret("legacy-plain-token")).toBe("legacy-plain-token");
  });

  it("each encryption uses fresh IV", () => {
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same");
    expect(decryptSecret(b)).toBe("same");
  });

  it("ensureEncrypted is no-op when already encrypted with current key", () => {
    const enc = encryptSecret("x");
    expect(ensureEncrypted(enc)).toBe(enc);
  });

  it("ensureEncrypted upgrades plaintext", () => {
    const upgraded = ensureEncrypted("legacy-plain")!;
    expect(upgraded).toMatch(/^enc:v2:/);
    expect(decryptSecret(upgraded)).toBe("legacy-plain");
  });

  it("tampered ciphertext fails authentication", () => {
    const enc = encryptSecret("hello");
    const tampered = enc.slice(0, -3) + (enc.slice(-3, -2) === "A" ? "B" : "A") + enc.slice(-2);
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("decrypts ciphertext written with an older key listed in WA_SECRET_KEYS_OLD", () => {
    // Encrypt with key A
    const encA = encryptSecret("rotation-target");
    // Now rotate: A becomes old, B is new
    process.env.WA_SECRET_KEY = KEY_B;
    process.env.WA_SECRET_KEYS_OLD = KEY_A;
    _resetSecretCipherKeysForTest();
    expect(decryptSecret(encA)).toBe("rotation-target");
  });

  it("ensureEncrypted re-encrypts a value to the current key during rotation", () => {
    const encA = encryptSecret("to-rotate");
    const oldId = keyIdOf(encA);
    process.env.WA_SECRET_KEY = KEY_B;
    process.env.WA_SECRET_KEYS_OLD = KEY_A;
    _resetSecretCipherKeysForTest();
    const rotated = ensureEncrypted(encA)!;
    expect(keyIdOf(rotated)).not.toBe(oldId);
    expect(decryptSecret(rotated)).toBe("to-rotate");
  });

  it("missing old key produces a helpful error", () => {
    const encA = encryptSecret("orphan");
    process.env.WA_SECRET_KEY = KEY_B;
    delete process.env.WA_SECRET_KEYS_OLD;
    _resetSecretCipherKeysForTest();
    expect(() => decryptSecret(encA)).toThrow(/no matching key/);
  });
});
