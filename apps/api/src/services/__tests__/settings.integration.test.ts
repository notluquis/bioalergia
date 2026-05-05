/**
 * Integration tests for the settings service.
 * Connects to the real PostgreSQL DB (DATABASE_URL from .env).
 * Read operations are safe on prod. Write tests use a dedicated
 * __test__ key and clean up after themselves.
 *
 * Runs automatically when DATABASE_URL is set in the environment.
 * Skips gracefully when DATABASE_URL is absent.
 */
import { afterAll, describe, expect, it } from "vitest";
import {
  deleteSetting,
  getSetting,
  loadSettings,
  updateSetting,
} from "../settings";

const hasDb = Boolean(process.env.DATABASE_URL);

const TEST_KEY = "__vitest_settings_integration__";

afterAll(async () => {
  await deleteSetting(TEST_KEY).catch(() => {});
});

describe.skipIf(!hasDb)("loadSettings (read-only)", () => {
  it("returns an AppSettings object with all expected keys", async () => {
    const settings = await loadSettings();
    expect(typeof settings.orgName).toBe("string");
    expect(typeof settings.primaryCurrency).toBe("string");
    expect(typeof settings.calendarTimeZone).toBe("string");
    // At minimum the default values are populated
    expect(settings.primaryCurrency.length).toBeGreaterThan(0);
  });
});

describe.skipIf(!hasDb)("getSetting (read-only)", () => {
  it("returns null for a key that does not exist", async () => {
    const result = await getSetting("__nonexistent_key_xyz__");
    expect(result).toBeNull();
  });
});

describe.skipIf(!hasDb)("updateSetting / getSetting (write with cleanup)", () => {
  it("upserts a setting and retrieves it", async () => {
    await updateSetting(TEST_KEY, "test-value-1");
    const value = await getSetting(TEST_KEY);
    expect(value).toBe("test-value-1");
  });

  it("overwrites an existing setting on second upsert", async () => {
    await updateSetting(TEST_KEY, "test-value-2");
    const value = await getSetting(TEST_KEY);
    expect(value).toBe("test-value-2");
  });
});
