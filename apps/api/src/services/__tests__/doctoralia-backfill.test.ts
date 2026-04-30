import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DOCTORALIA_BACKFILL_MIN_DATE,
  __resetDoctoraliaBackfillStateForTests,
  getDoctoraliaBackfillStatus,
  isDoctoraliaBackfillRunning,
  planDoctoraliaBackfill,
  startDoctoraliaBackfill,
} from "../doctoralia-backfill";

// We don't stub @finanzas/db because we never reach the sync layer in plan tests.
// For startDoctoraliaBackfill tests we mock the sync service to avoid DB access.
vi.mock("../doctoralia-calendar", () => ({
  doctoraliaCalendarSyncService: {
    syncCalendar: vi.fn().mockResolvedValue({
      success: true,
      schedules: { inserted: 0, updated: 0, skipped: 0 },
      appointments: { inserted: 0, updated: 0, skipped: 0 },
      workPeriods: { inserted: 0, updated: 0, skipped: 0 },
    }),
  },
}));

vi.mock("../../lib/logger", () => ({
  logEvent: vi.fn(),
  logWarn: vi.fn(),
}));

beforeEach(() => {
  __resetDoctoraliaBackfillStateForTests();
  process.env.DOCTORALIA_BACKFILL_WEEK_DELAY_MS = "0";
});

afterEach(() => {
  __resetDoctoraliaBackfillStateForTests();
});

describe("planDoctoraliaBackfill", () => {
  const NOW = new Date("2026-04-21T12:00:00-04:00"); // Tuesday, ISO week 17, Chile

  it("floors end date to MIN_DATE when earlier", () => {
    const plan = planDoctoraliaBackfill("2015-01-01", undefined, NOW);
    expect(plan.effectiveEndDate).toBe(DOCTORALIA_BACKFILL_MIN_DATE);
    expect(plan.weeksTotal).toBeGreaterThan(100);
  });

  it("rejects end dates inside or after the current ISO week", () => {
    // Current Monday in Chile is 2026-04-20.
    expect(() => planDoctoraliaBackfill("2026-04-20", undefined, NOW)).toThrow(/anterior a la semana actual/);
    expect(() => planDoctoraliaBackfill("2026-04-25", undefined, NOW)).toThrow(/anterior a la semana actual/);
    expect(() => planDoctoraliaBackfill("2026-05-10", undefined, NOW)).toThrow(/anterior a la semana actual/);
  });

  it("accepts a valid date strictly before current ISO week", () => {
    const plan = planDoctoraliaBackfill("2026-04-13", undefined, NOW);
    // From last-completed week (Apr 13 Monday) back to target week Apr 13 = 1 week.
    expect(plan.weeksTotal).toBe(1);
    expect(plan.effectiveEndDate).toBe("2026-04-13");
  });

  it("computes correct week count across months", () => {
    const plan = planDoctoraliaBackfill("2026-01-05", undefined, NOW);
    // Mondays from Apr 13 back to Jan 5 inclusive.
    // weeks = diff Apr13-Jan5 in weeks + 1 = 14 + 1 = 15.
    expect(plan.weeksTotal).toBe(15);
  });

  it("throws on invalid date string", () => {
    expect(() => planDoctoraliaBackfill("not-a-date", undefined, NOW)).toThrow();
  });
});

describe("startDoctoraliaBackfill (single-flight)", () => {
  it("rejects a second start while another run is in progress", async () => {
    // Pick a date that yields just 1 week so the loop finishes quickly;
    // slow the sync slightly so the first start is still in flight when we
    // try the second one.
    const { doctoraliaCalendarSyncService } = await import("../doctoralia-calendar");
    const slow = vi
      .mocked(doctoraliaCalendarSyncService.syncCalendar)
      .mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  success: true,
                  schedules: { inserted: 0, updated: 0, skipped: 0 },
                  appointments: { inserted: 0, updated: 0, skipped: 0 },
                  workPeriods: { inserted: 0, updated: 0, skipped: 0 },
                }),
              30,
            ),
          ),
      );

    // Must be strictly before the current ISO week; we can only control the
    // target, so reach back just one week from today in system time.
    const oneWeekAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    startDoctoraliaBackfill({ endDate: oneWeekAgo, triggeredByUserId: 1 });
    expect(isDoctoraliaBackfillRunning()).toBe(true);

    expect(() =>
      startDoctoraliaBackfill({ endDate: oneWeekAgo, triggeredByUserId: 2 }),
    ).toThrow(/en curso/i);

    await vi.waitFor(() => expect(isDoctoraliaBackfillRunning()).toBe(false), { timeout: 2_000 });
    slow.mockReset();
  });

  it("populates initial status fields synchronously", async () => {
    const oneWeekAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const result = startDoctoraliaBackfill({
      endDate: oneWeekAgo,
      triggeredByUserId: 42,
    });
    expect(result.running).toBe(true);
    expect(result.targetEndDate).toBe(oneWeekAgo);
    expect(result.triggeredByUserId).toBe(42);
    expect(result.weeksTotal).toBeGreaterThan(0);

    const status = getDoctoraliaBackfillStatus();
    expect(status.triggeredByUserId).toBe(42);

    await vi.waitFor(() => expect(isDoctoraliaBackfillRunning()).toBe(false), { timeout: 2_000 });
  });
});
