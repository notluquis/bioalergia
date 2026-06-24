import { afterEach, describe, expect, it, vi } from "vitest";

// normalizeLinkDate lives in dte-event-linking.ts, which transitively imports
// clinical-series.ts → @finanzas/db/slices, whose `db.$setOptions(...)` runs at
// module load. Mock both (db stub exposes $setOptions; slices stub replaces the
// real module so its load-time call never fires) per the repo's mock convention.
const { mockDb } = vi.hoisted(() => {
  const mockDb = { $setOptions: () => mockDb };
  return { mockDb };
});
vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { normalizeLinkDate } = await import("../dte-event-linking.ts");

// A link date is a CALENDAR DATE (the day the user picked), compared in the DB as
// `${date}::date`. It must round-trip its Y/M/D regardless of the process timezone.
// The previous implementation tz-converted the implicit local-midnight instant to
// America/Santiago, shifting the day by one whenever the process TZ was at/east of
// UTC — green locally (Santiago, UTC-4/-3), red in CI (UTC). These tests pin the
// timezone explicitly so the regression cannot come back unnoticed.
describe("normalizeLinkDate — timezone independence", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  // UTC + zones east of UTC are exactly where the old `.tz()` shifted the day.
  it.each(["UTC", "America/Santiago", "Asia/Tokyo", "Pacific/Kiritimati", "Etc/GMT+12"])(
    "round-trips calendar dates unchanged under TZ=%s",
    (tz) => {
      process.env.TZ = tz;
      expect(normalizeLinkDate("2026-04-23")).toBe("2026-04-23");
      expect(normalizeLinkDate("2026-01-01")).toBe("2026-01-01");
      expect(normalizeLinkDate("2026-12-31")).toBe("2026-12-31");
      expect(normalizeLinkDate("2024-02-29")).toBe("2024-02-29"); // leap day
    }
  );
});

describe("normalizeLinkDate — validation", () => {
  it("accepts a valid YYYY-MM-DD date unchanged", () => {
    expect(normalizeLinkDate("2026-04-23")).toBe("2026-04-23");
  });

  it("rejects an out-of-range date", () => {
    expect(() => normalizeLinkDate("13/13/2026")).toThrow("Fecha inválida");
  });

  it("rejects an unparseable string", () => {
    expect(() => normalizeLinkDate("not-a-date")).toThrow("Fecha inválida");
  });

  it("rejects an impossible calendar date (strict)", () => {
    expect(() => normalizeLinkDate("2026-02-30")).toThrow("Fecha inválida");
  });
});
