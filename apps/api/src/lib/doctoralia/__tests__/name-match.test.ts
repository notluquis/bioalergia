import { describe, expect, it } from "vitest";
import {
  DOCTORALIA_CANCELLED_STATUSES,
  DOCTORALIA_STATUS_CANCELLED_BY_DOCTOR,
  DOCTORALIA_STATUS_CANCELLED_BY_PATIENT,
  buildDoctoraliaMatchWindow,
  normalizePatientNameForMatch,
} from "../name-match";

describe("normalizePatientNameForMatch", () => {
  it("lowercases and removes accents", () => {
    expect(normalizePatientNameForMatch("María José")).toBe("maria jose");
    expect(normalizePatientNameForMatch("Ñoño Álvarez")).toBe("nono alvarez");
  });

  it("strips honorific prefixes", () => {
    expect(normalizePatientNameForMatch("Dr. Juan Pérez")).toBe("juan perez");
    expect(normalizePatientNameForMatch("Dra. Carmen López")).toBe("carmen lopez");
    expect(normalizePatientNameForMatch("Sr. Roberto")).toBe("roberto");
    expect(normalizePatientNameForMatch("Sra. Ana")).toBe("ana");
    expect(normalizePatientNameForMatch("Srta. Valeria")).toBe("valeria");
  });

  it("strips DR/DRA without dots", () => {
    expect(normalizePatientNameForMatch("DR Juan Perez")).toBe("juan perez");
    expect(normalizePatientNameForMatch("DRA Carmen Lopez")).toBe("carmen lopez");
  });

  it("collapses extra whitespace", () => {
    expect(normalizePatientNameForMatch("  Juan   Pablo  ")).toBe("juan pablo");
  });

  it("handles empty string", () => {
    expect(normalizePatientNameForMatch("")).toBe("");
  });

  it("preserves non-accent special chars", () => {
    expect(normalizePatientNameForMatch("O'Brien")).toBe("o'brien");
  });
});

describe("buildDoctoraliaMatchWindow", () => {
  it("returns window ±1 minute around the minute boundary", () => {
    const date = new Date("2026-04-20T10:30:45.000Z");
    const { windowStart, windowEnd } = buildDoctoraliaMatchWindow(date);
    // minute = floor(10:30:45 / 60s) * 60s = 10:30:00
    // windowStart = 10:30:00 - 60s = 10:29:00
    // windowEnd   = 10:30:00 + 60s = 10:31:00
    expect(windowEnd.getTime() - windowStart.getTime()).toBe(2 * 60 * 1000);
  });

  it("start is before, end is after appointment minute", () => {
    const date = new Date("2026-01-01T09:00:00.000Z");
    const { windowStart, windowEnd } = buildDoctoraliaMatchWindow(date);
    expect(windowStart.getTime()).toBeLessThan(date.getTime());
    expect(windowEnd.getTime()).toBeGreaterThan(date.getTime());
  });
});

describe("DOCTORALIA_CANCELLED_STATUSES", () => {
  it("contains both patient and doctor cancellation codes", () => {
    expect(DOCTORALIA_CANCELLED_STATUSES).toContain(DOCTORALIA_STATUS_CANCELLED_BY_PATIENT);
    expect(DOCTORALIA_CANCELLED_STATUSES).toContain(DOCTORALIA_STATUS_CANCELLED_BY_DOCTOR);
    expect(DOCTORALIA_STATUS_CANCELLED_BY_PATIENT).toBe(2);
    expect(DOCTORALIA_STATUS_CANCELLED_BY_DOCTOR).toBe(3);
  });
});
