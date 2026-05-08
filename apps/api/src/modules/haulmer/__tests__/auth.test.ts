import { describe, expect, it } from "vitest";
import { isJWTExpired } from "../auth";

describe("isJWTExpired", () => {
  it("returns false for future expiry beyond 5-minute buffer", () => {
    const future = new Date(Date.now() + 10 * 60 * 1000);
    expect(isJWTExpired(future)).toBe(false);
  });

  it("returns true for expiry within 5-minute buffer", () => {
    const nearExpiry = new Date(Date.now() + 2 * 60 * 1000);
    expect(isJWTExpired(nearExpiry)).toBe(true);
  });

  it("returns true for already expired token", () => {
    const past = new Date(Date.now() - 60 * 1000);
    expect(isJWTExpired(past)).toBe(true);
  });
});
