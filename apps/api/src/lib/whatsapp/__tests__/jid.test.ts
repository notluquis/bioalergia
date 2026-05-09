import { describe, expect, it } from "vitest";
import { isWhatsappUserJid, jidToPhone, normalizePhone, phoneToJid } from "../jid.ts";

describe("normalizePhone", () => {
  it("passes through valid E.164 numbers unchanged", () => {
    expect(normalizePhone("+56912345678")).toBe("+56912345678");
    expect(normalizePhone("+14155551234")).toBe("+14155551234");
  });

  it("adds + prefix to 56+9digit numbers", () => {
    expect(normalizePhone("56912345678")).toBe("+56912345678");
  });

  it("adds +56 prefix to 9-digit mobile numbers", () => {
    expect(normalizePhone("912345678")).toBe("+56912345678");
  });

  it("adds +569 prefix to 8-digit numbers (Doctoralia drops leading 9)", () => {
    expect(normalizePhone("12345678")).toBe("+5691234 5678".replace(/\s/g, ""));
    expect(normalizePhone("98765432")).toBe("+56998765432");
  });

  it("strips whitespace, dashes, parentheses, dots", () => {
    expect(normalizePhone("+56 9 1234 5678")).toBe("+56912345678");
    expect(normalizePhone("+56-9-1234-5678")).toBe("+56912345678");
    expect(normalizePhone("(+569)12345678")).toBe("+56912345678");
  });

  it("adds + to bare number without prefix", () => {
    const result = normalizePhone("14155551234");
    expect(result).toBe("+14155551234");
  });
});

describe("phoneToJid", () => {
  it("converts E.164 number to JID", () => {
    expect(phoneToJid("+56912345678")).toBe("56912345678@s.whatsapp.net");
  });

  it("normalizes first then converts", () => {
    expect(phoneToJid("912345678")).toBe("56912345678@s.whatsapp.net");
    expect(phoneToJid("56912345678")).toBe("56912345678@s.whatsapp.net");
  });
});

describe("isWhatsappUserJid", () => {
  it("accepts valid user JIDs", () => {
    expect(isWhatsappUserJid("56912345678@s.whatsapp.net")).toBe(true);
    expect(isWhatsappUserJid("14155551234@s.whatsapp.net")).toBe(true);
  });

  it("rejects group JIDs", () => {
    expect(isWhatsappUserJid("123456789@g.us")).toBe(false);
  });

  it("rejects bare numbers", () => {
    expect(isWhatsappUserJid("+56912345678")).toBe(false);
  });

  it("rejects short numbers (less than 8 digits)", () => {
    expect(isWhatsappUserJid("123@s.whatsapp.net")).toBe(false);
  });
});

describe("jidToPhone", () => {
  it("converts JID back to E.164", () => {
    expect(jidToPhone("56912345678@s.whatsapp.net")).toBe("+56912345678");
  });

  it("preserves international numbers", () => {
    expect(jidToPhone("14155551234@s.whatsapp.net")).toBe("+14155551234");
  });
});
