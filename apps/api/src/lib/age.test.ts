import { describe, expect, it } from "vitest";
import { ageFromBirthDate } from "./time.ts";

describe("ageFromBirthDate", () => {
  it("returns undefined for null/empty", () => {
    expect(ageFromBirthDate(null)).toBeUndefined();
    expect(ageFromBirthDate(undefined)).toBeUndefined();
    expect(ageFromBirthDate("")).toBeUndefined();
  });

  it("computes completed years from a @db.Date (UTC-midnight Date)", () => {
    // Nace hace ~30 años exactos.
    const now = new Date();
    const birth = new Date(Date.UTC(now.getUTCFullYear() - 30, 0, 1));
    const age = ageFromBirthDate(birth);
    // 30 si ya pasó el 1 de enero (siempre), 29 sólo el 1 de enero antes de UTC.
    expect(age === 30 || age === 29).toBe(true);
  });

  it("accepts YYYY-MM-DD strings", () => {
    expect(ageFromBirthDate("2000-01-01")).toBeGreaterThanOrEqual(25);
  });

  it("subtracts a year before the birthday", () => {
    const now = new Date();
    const futureMonth = ((now.getUTCMonth() + 2) % 12) + 1; // mes futuro 1..12
    const yearsAgo = 40;
    const birth = `${now.getUTCFullYear() - yearsAgo}-${String(futureMonth).padStart(2, "0")}-28`;
    const age = ageFromBirthDate(birth);
    // Cumpleaños en mes futuro → aún no cumple este año (salvo wrap dic→ene).
    if (futureMonth > now.getUTCMonth() + 1) expect(age).toBe(yearsAgo - 1);
  });

  it("rejects out-of-range (future / >130y)", () => {
    expect(ageFromBirthDate("2999-01-01")).toBeUndefined();
    expect(ageFromBirthDate("1800-01-01")).toBeUndefined();
  });
});
