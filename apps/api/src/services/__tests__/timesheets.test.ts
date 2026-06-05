import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// timesheets.ts imports `db` from @finanzas/db at module load and transitively
// pulls in ./employees.ts (also imports db). We test ONLY the pure helpers, so
// the db client is never exercised — but the import must not crash. We stub a
// noop db with $setOptions so neither @finanzas/db nor /slices throws at import.
const { noopDb } = vi.hoisted(() => {
  const noopDb = { $setOptions: () => noopDb };
  return { noopDb };
});
vi.mock("@finanzas/db", () => ({ db: noopDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: noopDb }));

import type { UpsertTimesheetPayload } from "../timesheets.ts";
import {
  calculateWorkedMinutes,
  dateOnlyEndUtc,
  dateOnlyStartUtc,
  dateToTimeString,
  formatDbDateOnly,
  monthStartUtc,
  normalizeTimeString,
  normalizeUpsertPayload,
  parseDateOnlyUtc,
  timeStringToDate,
  timeToMinutes,
} from "../timesheets.ts";

// Build a minimal UpsertTimesheetPayload; only the fields the function under
// test reads matter, the rest satisfy the type.
function payload(overrides: Partial<UpsertTimesheetPayload>): UpsertTimesheetPayload {
  return {
    employee_id: 1,
    work_date: "2026-01-15",
    overtime_minutes: 0,
    ...overrides,
  };
}

describe("parseDateOnlyUtc", () => {
  it("parses a valid YYYY-MM-DD into a valid UTC dayjs", () => {
    const d = parseDateOnlyUtc("2026-03-09");
    expect(d.isValid()).toBe(true);
    expect(d.year()).toBe(2026);
    expect(d.month()).toBe(2); // 0-indexed: March
    expect(d.date()).toBe(9);
    expect(d.hour()).toBe(0);
    expect(d.minute()).toBe(0);
  });

  it("is invalid for a non-strict / wrong format", () => {
    expect(parseDateOnlyUtc("2026-3-9").isValid()).toBe(false);
    expect(parseDateOnlyUtc("03/09/2026").isValid()).toBe(false);
    expect(parseDateOnlyUtc("not-a-date").isValid()).toBe(false);
    expect(parseDateOnlyUtc("").isValid()).toBe(false);
  });

  it("rejects an out-of-range month via strict parsing", () => {
    expect(parseDateOnlyUtc("2026-13-01").isValid()).toBe(false);
  });
});

describe("dateOnlyStartUtc", () => {
  it("returns the UTC start-of-day instant", () => {
    const d = dateOnlyStartUtc("2026-03-09");
    expect(d.toISOString()).toBe("2026-03-09T00:00:00.000Z");
  });

  it("handles a leap day", () => {
    expect(dateOnlyStartUtc("2024-02-29").toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });

  it("throws on invalid format with a descriptive message", () => {
    expect(() => dateOnlyStartUtc("2026-3-9")).toThrow(/Invalid date format/);
    expect(() => dateOnlyStartUtc("bad")).toThrow(/Expected YYYY-MM-DD/);
  });
});

describe("dateOnlyEndUtc", () => {
  it("returns the UTC end-of-day instant (23:59:59.999)", () => {
    const d = dateOnlyEndUtc("2026-03-09");
    expect(d.toISOString()).toBe("2026-03-09T23:59:59.999Z");
  });

  it("differs from start-of-day by one millisecond short of a day", () => {
    const start = dateOnlyStartUtc("2026-03-09").getTime();
    const end = dateOnlyEndUtc("2026-03-09").getTime();
    expect(end - start).toBe(86_400_000 - 1);
  });

  it("throws on invalid format", () => {
    expect(() => dateOnlyEndUtc("nope")).toThrow(/Invalid date format/);
  });
});

describe("monthStartUtc", () => {
  it("returns the UTC start-of-month dayjs for YYYY-MM", () => {
    const d = monthStartUtc("2026-03");
    expect(d.toDate().toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("supports adding a month to derive the exclusive upper bound", () => {
    const next = monthStartUtc("2026-12").add(1, "month");
    expect(next.toDate().toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("throws on a full date or invalid month", () => {
    expect(() => monthStartUtc("2026-03-01")).toThrow(/Invalid month format/);
    expect(() => monthStartUtc("2026-13")).toThrow(/Expected YYYY-MM/);
  });
});

describe("formatDbDateOnly", () => {
  it("formats a Date to YYYY-MM-DD in UTC", () => {
    expect(formatDbDateOnly(new Date("2026-03-09T23:30:00.000Z"))).toBe("2026-03-09");
  });

  it("formats an ISO string to YYYY-MM-DD in UTC", () => {
    expect(formatDbDateOnly("2026-07-04T00:00:00.000Z")).toBe("2026-07-04");
  });

  it("uses the UTC calendar day even near midnight", () => {
    expect(formatDbDateOnly(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01-01");
  });
});

describe("timeToMinutes", () => {
  it("converts HH:MM to minutes since midnight", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("01:00")).toBe(60);
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("23:59")).toBe(1439);
  });

  it("converts HH:MM:SS (seconds ignored) to minutes", () => {
    expect(timeToMinutes("09:30:45")).toBe(570);
    expect(timeToMinutes("12:00:00")).toBe(720);
  });

  it("handles single-digit hours", () => {
    expect(timeToMinutes("9:05")).toBe(545);
  });

  it("throws on empty string", () => {
    expect(() => timeToMinutes("")).toThrow(/Time string is required/);
  });

  it("throws on malformed strings", () => {
    expect(() => timeToMinutes("9h30")).toThrow(/Invalid time format/);
    expect(() => timeToMinutes("12:")).toThrow(/Invalid time format/);
  });

  it("throws when hours/minutes are out of range", () => {
    expect(() => timeToMinutes("24:00")).toThrow(/Time out of range/);
    expect(() => timeToMinutes("12:60")).toThrow(/Time out of range/);
  });
});

describe("normalizeTimeString", () => {
  it("returns null for empty input", () => {
    expect(normalizeTimeString("")).toBeNull();
  });

  it("normalizes HH:MM to HH:MM:SS with zero seconds", () => {
    expect(normalizeTimeString("09:05")).toBe("09:05:00");
    expect(normalizeTimeString("9:5".replace("9:5", "09:05"))).toBe("09:05:00");
  });

  it("pads single-digit hours", () => {
    expect(normalizeTimeString("7:30")).toBe("07:30:00");
  });

  it("preserves seconds in HH:MM:SS", () => {
    expect(normalizeTimeString("23:59:59")).toBe("23:59:59");
    expect(normalizeTimeString("00:00:00")).toBe("00:00:00");
  });

  it("returns null for malformed time", () => {
    expect(normalizeTimeString("abc")).toBeNull();
    expect(normalizeTimeString("12h")).toBeNull();
  });

  it("returns null for out-of-range components", () => {
    expect(normalizeTimeString("24:00")).toBeNull();
    expect(normalizeTimeString("10:60")).toBeNull();
    expect(normalizeTimeString("10:10:60")).toBeNull();
  });

  it("converts an ISO timestamp to Santiago-local HH:MM:SS", () => {
    // 2026-01-15T12:40:00Z; Santiago in January is UTC-3 (summer / CLST) -> 09:40:00
    expect(normalizeTimeString("2026-01-15T12:40:00.000Z")).toBe("09:40:00");
  });

  it("converts an ISO timestamp in winter (UTC-3 standard) correctly", () => {
    // 2026-07-15T15:00:00Z; Santiago in July is UTC-4 (winter / CLT) -> 11:00:00
    expect(normalizeTimeString("2026-07-15T15:00:00.000Z")).toBe("11:00:00");
  });
});

describe("timeStringToDate", () => {
  it("anchors HH:MM as the UTC wall-clock time (no +3h/+4h shift)", () => {
    // @db.Time round-trips by UTC components: 09:00 must be stored as 09:00Z,
    // NOT 12:00Z. The reference day is preserved (UTC), time set from input.
    const ref = new Date("2026-01-15T12:00:00.000Z");
    const d = timeStringToDate("09:00", ref);
    expect(d.toISOString()).toBe("2026-01-15T09:00:00.000Z");
  });

  it("builds a Date from HH:MM:SS preserving seconds", () => {
    const ref = new Date("2026-01-15T05:00:00.000Z");
    const d = timeStringToDate("09:30:15", ref);
    expect(d.toISOString()).toBe("2026-01-15T09:30:15.000Z");
  });

  it("is timezone-independent — winter/summer offsets do not shift the time", () => {
    const ref = new Date("2026-07-15T12:00:00.000Z");
    const d = timeStringToDate("08:00", ref);
    expect(d.toISOString()).toBe("2026-07-15T08:00:00.000Z");
  });

  it("anchors the reference day in UTC (a Santiago-evening ref keeps its UTC day)", () => {
    // 2026-05-04T00:00:00Z is how ZenStack returns a @db.Date workDate. The
    // stored time component must land on that same UTC day, not roll back.
    const ref = new Date("2026-05-04T00:00:00.000Z");
    const d = timeStringToDate("10:30", ref);
    expect(d.toISOString()).toBe("2026-05-04T10:30:00.000Z");
  });

  it("throws when no time string is provided", () => {
    expect(() => timeStringToDate(null)).toThrow(/Time string is required/);
    expect(() => timeStringToDate(undefined)).toThrow(/Time string is required/);
    expect(() => timeStringToDate("")).toThrow(/Time string is required/);
  });

  it("throws on out-of-range components", () => {
    expect(() => timeStringToDate("24:00")).toThrow(/Invalid time components/);
    expect(() => timeStringToDate("10:60")).toThrow(/Invalid time components/);
  });

  it("throws on an unparseable string", () => {
    expect(() => timeStringToDate("nonsense")).toThrow(/Unable to parse time string/);
  });
});

describe("dateToTimeString", () => {
  it("returns null for null input", () => {
    expect(dateToTimeString(null)).toBeNull();
  });

  it("extracts HH:MM from an HH:MM string", () => {
    expect(dateToTimeString("09:30")).toBe("09:30");
  });

  it("extracts HH:MM from an HH:MM:SS string (drops seconds)", () => {
    expect(dateToTimeString("23:59:59")).toBe("23:59");
  });

  it("pads single-digit hours from a string", () => {
    expect(dateToTimeString("7:05")).toBe("07:05");
  });

  it("formats a UTC-anchored @db.Time Date to HH:mm (no TZ shift)", () => {
    // ZenStack/Prisma returns @db.Time columns as Dates anchored at
    // 1970-01-01 in UTC. Must format in UTC so server TZ (America/Santiago)
    // doesn't shift the wall-clock time by -3h.
    const date = new Date("1970-01-01T08:15:00.000Z");
    expect(dateToTimeString(date)).toBe("08:15");
  });

  it("returns null for an unparseable string", () => {
    expect(dateToTimeString("not-a-time")).toBeNull();
  });
});

describe("normalizeUpsertPayload (regression: work_date must not roll back a day)", () => {
  // Bug 2026-06-05: under server TZ=America/Santiago, `dayjs(utcMidnight).format`
  // rolled the work_date back one day (2026-05-04 stored as 2026-05-03). The
  // vitest env pins TZ=America/Santiago so this test reproduces the prod TZ.
  it("preserves the work_date string round-trip", () => {
    const n = normalizeUpsertPayload(
      payload({ work_date: "2026-05-04", start_time: "10:30", end_time: "19:45" })
    );
    expect(n.workDateDb).toBe("2026-05-04");
  });

  it("keeps times as plain HH:MM:SS strings (no TZ shift on write)", () => {
    const n = normalizeUpsertPayload(
      payload({ work_date: "2026-05-04", start_time: "10:30", end_time: "19:45" })
    );
    expect(n.startTimeStr).toBe("10:30:00");
    expect(n.endTimeStr).toBe("19:45:00");
  });

  it("preserves work_date across a DST boundary (winter month)", () => {
    const n = normalizeUpsertPayload(payload({ work_date: "2026-07-15" }));
    expect(n.workDateDb).toBe("2026-07-15");
  });
});

describe("calculateWorkedMinutes", () => {
  it("returns the provided worked_minutes when positive", () => {
    expect(calculateWorkedMinutes(payload({ worked_minutes: 480 }))).toBe(480);
  });

  it("prefers provided worked_minutes even when start/end are present", () => {
    expect(
      calculateWorkedMinutes(
        payload({ worked_minutes: 100, start_time: "09:00", end_time: "18:00" })
      )
    ).toBe(100);
  });

  it("returns 0 when worked_minutes is 0 and start/end missing", () => {
    expect(calculateWorkedMinutes(payload({}))).toBe(0);
    expect(calculateWorkedMinutes(payload({ start_time: "09:00" }))).toBe(0);
    expect(calculateWorkedMinutes(payload({ end_time: "18:00" }))).toBe(0);
  });

  it("computes the difference for a normal same-day shift", () => {
    expect(calculateWorkedMinutes(payload({ start_time: "09:00", end_time: "17:30" }))).toBe(510);
  });

  it("handles a midnight-rollover overnight shift", () => {
    // 22:00 -> 06:00 = 8h = 480 min
    expect(calculateWorkedMinutes(payload({ start_time: "22:00", end_time: "06:00" }))).toBe(480);
  });

  it("treats equal start and end as zero minutes (not a full day)", () => {
    expect(calculateWorkedMinutes(payload({ start_time: "09:00", end_time: "09:00" }))).toBe(0);
  });

  it("computes a one-minute shift correctly", () => {
    expect(calculateWorkedMinutes(payload({ start_time: "09:00", end_time: "09:01" }))).toBe(1);
  });

  it("computes a full-day-minus-one-minute overnight shift", () => {
    // 09:01 start, 09:00 end next day -> 24*60 + (540 - 541) = 1439
    expect(calculateWorkedMinutes(payload({ start_time: "09:01", end_time: "09:00" }))).toBe(1439);
  });

  it("treats negative worked_minutes as not-provided and computes from times", () => {
    expect(
      calculateWorkedMinutes(
        payload({ worked_minutes: -5, start_time: "09:00", end_time: "10:00" })
      )
    ).toBe(60);
  });
});

// Sanity: ensure the time-dependent default (referenceDate = new Date()) of
// timeStringToDate is exercised with a pinned clock so a mutated default is
// caught.
describe("timeStringToDate default reference date (pinned clock)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-15T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("anchors to today's UTC date when no reference is given", () => {
    // System now: 2026-05-15T12:00:00Z. UTC day is 2026-05-15; 09:00 wall-clock
    // is anchored as 09:00Z on that day (no TZ offset applied).
    const d = timeStringToDate("09:00");
    expect(d.toISOString()).toBe("2026-05-15T09:00:00.000Z");
  });
});
