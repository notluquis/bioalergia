import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyMetaSignature } from "../webhook-handler.ts";

describe("verifyMetaSignature", () => {
  const appSecret = "test-secret-12345";
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  const validSig = `sha256=${createHmac("sha256", appSecret).update(body).digest("hex")}`;

  it("returns true for matching signature", () => {
    expect(verifyMetaSignature(body, validSig, appSecret)).toBe(true);
  });

  it("returns false when body tampered", () => {
    const tampered = body + "extra";
    expect(verifyMetaSignature(tampered, validSig, appSecret)).toBe(false);
  });

  it("returns false when signature wrong", () => {
    expect(verifyMetaSignature(body, "sha256=deadbeef", appSecret)).toBe(false);
  });

  it("returns false when appSecret missing", () => {
    expect(verifyMetaSignature(body, validSig, undefined)).toBe(false);
  });

  it("returns false when signature header missing", () => {
    expect(verifyMetaSignature(body, undefined, appSecret)).toBe(false);
  });

  it("returns false when both missing", () => {
    expect(verifyMetaSignature(body, undefined, undefined)).toBe(false);
  });

  it("uses constant-time comparison (different length → safe false)", () => {
    expect(verifyMetaSignature(body, "sha256=short", appSecret)).toBe(false);
  });
});
