import { describe, expect, it } from "vitest";
import { normalizeToE164, stripPlus } from "../phone";

describe("normalizeToE164", () => {
  it("keeps E.164 number unchanged (strips non-digits then re-adds +)", () => {
    expect(normalizeToE164("+56912345678")).toBe("+56912345678");
  });

  it("adds +56 prefix to 9-digit mobile number", () => {
    expect(normalizeToE164("912345678")).toBe("+56912345678");
  });

  it("adds + to 11-digit number starting with 56", () => {
    expect(normalizeToE164("56912345678")).toBe("+56912345678");
  });

  it("handles 00 prefix (international dialing)", () => {
    expect(normalizeToE164("0056912345678")).toBe("+56912345678");
  });

  it("adds Santiago landline prefix for 8-digit numbers", () => {
    expect(normalizeToE164("12345678")).toBe("+56212345678");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeToE164("")).toBe("");
  });

  it("strips non-digit characters before processing", () => {
    expect(normalizeToE164("+56 9 1234-5678")).toBe("+56912345678");
  });
});

describe("stripPlus", () => {
  it("removes leading + from E.164", () => {
    expect(stripPlus("+56912345678")).toBe("56912345678");
  });

  it("leaves number without + unchanged", () => {
    expect(stripPlus("56912345678")).toBe("56912345678");
  });
});
