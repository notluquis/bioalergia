/**
 * Tests for the dayjs configuration module.
 *
 * Validates that every required plugin is registered AND that the
 * defaults (Spanish locale + Santiago tz) are applied on import.
 */
import { describe, expect, it } from "vitest";

import { dayjs, TIMEZONE } from "./dayjs";

describe("dayjs configuration", () => {
  it("exports the Chilean timezone constant", () => {
    expect(TIMEZONE).toBe("America/Santiago");
  });

  it("uses Spanish as default locale", () => {
    expect(dayjs.locale()).toBe("es");
  });

  it("formats months in Spanish via the locale", () => {
    // 2026-01-15 — January 2026
    expect(dayjs("2026-01-15").format("MMMM")).toMatch(/enero/i);
  });

  it("has the utc plugin loaded (.utc() chainable)", () => {
    expect(typeof dayjs.utc).toBe("function");
    expect(dayjs.utc().isValid()).toBe(true);
  });

  it("has the timezone plugin loaded (.tz chainable)", () => {
    expect(typeof dayjs().tz).toBe("function");
    expect(dayjs.tz("2026-05-01T12:00:00", TIMEZONE).isValid()).toBe(true);
  });

  it("has isoWeek plugin loaded", () => {
    expect(typeof dayjs().isoWeek).toBe("function");
  });

  it("has isSameOrAfter / isSameOrBefore plugins loaded", () => {
    const a = dayjs("2026-05-01");
    const b = dayjs("2026-05-01");
    expect(a.isSameOrAfter(b)).toBe(true);
    expect(a.isSameOrBefore(b)).toBe(true);
  });

  it("has relativeTime plugin loaded", () => {
    expect(typeof dayjs().fromNow).toBe("function");
  });

  it("has customParseFormat plugin (.format string parsing)", () => {
    const d = dayjs("15/05/2026", "DD/MM/YYYY");
    expect(d.isValid()).toBe(true);
    expect(d.year()).toBe(2026);
    expect(d.month()).toBe(4); // May
    expect(d.date()).toBe(15);
  });

  it("has localeData plugin loaded (.localeData chainable)", () => {
    expect(typeof dayjs.localeData).toBe("function");
  });

  it("has isYesterday plugin loaded", () => {
    expect(typeof dayjs().isYesterday).toBe("function");
  });
});
