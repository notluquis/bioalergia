import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, dbKeyToSettingsKey, settingsKeyToDbKey } from "../settings.ts";

describe("settingsKeyToDbKey", () => {
  it("maps known app keys to db keys", () => {
    expect(settingsKeyToDbKey("orgName")).toBe("brand.orgName");
    expect(settingsKeyToDbKey("primaryColor")).toBe("brand.primaryColor");
    expect(settingsKeyToDbKey("calendarTimeZone")).toBe("calendar.timeZone");
    expect(settingsKeyToDbKey("primaryCurrency")).toBe("org.primaryCurrency");
    expect(settingsKeyToDbKey("pageTitle")).toBe("page.title");
  });
});

describe("dbKeyToSettingsKey", () => {
  it("maps known db keys back to app keys", () => {
    expect(dbKeyToSettingsKey("brand.orgName")).toBe("orgName");
    expect(dbKeyToSettingsKey("calendar.timeZone")).toBe("calendarTimeZone");
    expect(dbKeyToSettingsKey("org.primaryCurrency")).toBe("primaryCurrency");
  });

  it("returns null for unknown db keys", () => {
    expect(dbKeyToSettingsKey("unknown.key")).toBeNull();
    expect(dbKeyToSettingsKey("")).toBeNull();
  });

  it("round-trips: settingsKey → dbKey → settingsKey", () => {
    for (const appKey of Object.keys(DEFAULT_SETTINGS) as (keyof typeof DEFAULT_SETTINGS)[]) {
      const dbKey = settingsKeyToDbKey(appKey);
      expect(dbKeyToSettingsKey(dbKey)).toBe(appKey);
    }
  });
});

describe("DEFAULT_SETTINGS", () => {
  it("has expected org defaults", () => {
    expect(DEFAULT_SETTINGS.orgName).toBe("Bioalergia");
    expect(DEFAULT_SETTINGS.primaryCurrency).toBe("CLP");
    expect(DEFAULT_SETTINGS.calendarTimeZone).toBe("America/Santiago");
  });

  it("all string values", () => {
    for (const value of Object.values(DEFAULT_SETTINGS)) {
      expect(typeof value).toBe("string");
    }
  });
});
