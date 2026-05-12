import { describe, expect, it } from "vitest";
import { zApiDateOnly, zDateString, parseOrThrow, zStatusOk } from "../api-validate";

describe("zDateString", () => {
  it("accepts YYYY-MM-DD", () => {
    expect(zDateString.safeParse("2026-01-15").success).toBe(true);
  });

  it("rejects invalid formats", () => {
    expect(zDateString.safeParse("15/01/2026").success).toBe(false);
    expect(zDateString.safeParse("2026-1-5").success).toBe(false);
    expect(zDateString.safeParse("").success).toBe(false);
  });
});

describe("zApiDateOnly", () => {
  it("accepts YYYY-MM-DD and returns it", () => {
    expect(zApiDateOnly.parse("2026-01-15")).toBe("2026-01-15");
  });

  it("accepts datetime string and extracts date part", () => {
    expect(zApiDateOnly.parse("2026-01-15T10:30:00Z")).toBe("2026-01-15");
    expect(zApiDateOnly.parse("2026-01-15 10:30:00")).toBe("2026-01-15");
  });

  it("coerces a Date object to YYYY-MM-DD string", () => {
    const result = zApiDateOnly.parse(new Date("2026-03-20T00:00:00.000Z"));
    expect(result).toBe("2026-03-20");
  });
});

describe("zStatusOk", () => {
  it("accepts { status: 'ok' }", () => {
    expect(zStatusOk.safeParse({ status: "ok" }).success).toBe(true);
  });

  it("rejects other status values", () => {
    expect(zStatusOk.safeParse({ status: "error" }).success).toBe(false);
    expect(zStatusOk.safeParse({}).success).toBe(false);
  });
});

describe("parseOrThrow", () => {
  it("returns parsed data for valid input", () => {
    const result = parseOrThrow(zDateString, "2026-01-15", "Invalid date");
    expect(result).toBe("2026-01-15");
  });

  it("throws with provided message for invalid input", () => {
    expect(() => parseOrThrow(zDateString, "not-a-date", "Date invalid")).toThrow("Date invalid");
  });
});
