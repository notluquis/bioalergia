import { describe, expect, it } from "vitest";

import { SCRAPER_TIMEZONE, selectWindowsForTick, type TierKey } from "./window-selector";

// Build a Date that corresponds to the given wall-clock in America/Santiago.
// We assume the Chile offset because the scraper runs against that locale.
// Offset here is -04:00 (post-DST-abolition, year-round standard time).
function chileTime(iso: string): Date {
  return new Date(`${iso}-04:00`);
}

function tiers(now: Date): TierKey[] {
  return selectWindowsForTick(now, SCRAPER_TIMEZONE).map((w) => w.tier);
}

describe("selectWindowsForTick — business-hours gate", () => {
  it("returns empty at 08:30 Chile time", () => {
    expect(selectWindowsForTick(chileTime("2026-04-21T08:30:00"))).toEqual([]);
  });

  it("returns empty at 19:00 Chile time (exclusive upper bound)", () => {
    expect(selectWindowsForTick(chileTime("2026-04-21T19:00:00"))).toEqual([]);
  });

  it("returns empty at 22:00 Chile time", () => {
    expect(selectWindowsForTick(chileTime("2026-04-21T22:00:00"))).toEqual([]);
  });

  it("fires at 09:00 Chile time (first tick of day)", () => {
    const result = selectWindowsForTick(chileTime("2026-04-21T09:00:00"));
    expect(result.length).toBeGreaterThan(0);
  });

  it("fires at 18:30 Chile time (last tick of day)", () => {
    const result = selectWindowsForTick(chileTime("2026-04-21T18:30:00"));
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("selectWindowsForTick — tier firing rules", () => {
  it("always emits W0 at every in-hours tick", () => {
    // 2026-04-21 is a Tuesday — so we avoid Monday/first-tick-of-week side effects.
    const picks = tiers(chileTime("2026-04-21T10:30:00"));
    expect(picks).toContain("W0");
  });

  it("first tick of day (09:00) emits W0 + W1 + W2 (tickInDay=0 satisfies both rules)", () => {
    // Tuesday → Monday rules don't trigger, so no M tiers.
    const picks = tiers(chileTime("2026-04-21T09:00:00"));
    expect(picks).toContain("W0");
    expect(picks).toContain("W1");
    expect(picks).toContain("W2");
    expect(picks).not.toContain("M1");
    expect(picks).not.toContain("M2");
    expect(picks).not.toContain("M3");
  });

  it("W1 fires every 3rd tick of day (09:00, 10:30, 12:00, …)", () => {
    // Tuesday to avoid Monday firings.
    // tickInDay=0 → 09:00, fires.
    expect(tiers(chileTime("2026-04-21T09:00:00"))).toContain("W1");
    // tickInDay=1 → 09:30, does NOT fire (1 % 3 !== 0).
    expect(tiers(chileTime("2026-04-21T09:30:00"))).not.toContain("W1");
    // tickInDay=3 → 10:30, fires.
    expect(tiers(chileTime("2026-04-21T10:30:00"))).toContain("W1");
    // tickInDay=6 → 12:00, fires.
    expect(tiers(chileTime("2026-04-21T12:00:00"))).toContain("W1");
  });

  it("W2 fires only at the first tick of the day", () => {
    // Tuesday, 09:00 → W2 fires
    expect(tiers(chileTime("2026-04-21T09:00:00"))).toContain("W2");
    // Tuesday, 09:30 → no W2
    expect(tiers(chileTime("2026-04-21T09:30:00"))).not.toContain("W2");
    // Tuesday, 10:30 → no W2
    expect(tiers(chileTime("2026-04-21T10:30:00"))).not.toContain("W2");
  });

  it("M1 fires only on the first tick of Monday", () => {
    // 2026-04-20 is a Monday.
    expect(tiers(chileTime("2026-04-20T09:00:00"))).toContain("M1");
    expect(tiers(chileTime("2026-04-20T09:30:00"))).not.toContain("M1");
    // Tuesday first tick — no M1.
    expect(tiers(chileTime("2026-04-21T09:00:00"))).not.toContain("M1");
  });

  it("M2 fires on first tick of Monday when ISO week is even", () => {
    // 2026-04-20 Monday → ISO week 17 (odd) → no M2.
    expect(tiers(chileTime("2026-04-20T09:00:00"))).not.toContain("M2");
    // 2026-04-27 Monday → ISO week 18 (even) → fires.
    expect(tiers(chileTime("2026-04-27T09:00:00"))).toContain("M2");
  });

  it("M3 fires on first tick of Monday when ISO week % 3 === 0", () => {
    // ISO weeks: 2026-04-20 is week 17 (no), 2026-04-27 is week 18 (yes, 18 % 3 === 0).
    expect(tiers(chileTime("2026-04-20T09:00:00"))).not.toContain("M3");
    expect(tiers(chileTime("2026-04-27T09:00:00"))).toContain("M3");
    // 2026-05-04 is ISO week 19 (no).
    expect(tiers(chileTime("2026-05-04T09:00:00"))).not.toContain("M3");
  });
});

describe("selectWindowsForTick — window shapes", () => {
  it("W0 spans Monday→Sunday of the current ISO week", () => {
    // Tuesday 2026-04-21 → ISO week starts Monday 2026-04-20.
    const windows = selectWindowsForTick(chileTime("2026-04-21T10:30:00"));
    const w0 = windows.find((w) => w.tier === "W0");
    expect(w0).toBeDefined();
    expect(w0?.from).toBe("2026-04-20");
    expect(w0?.to).toBe("2026-04-26T23:59:59");
  });

  it("W1 spans the following ISO week", () => {
    const windows = selectWindowsForTick(chileTime("2026-04-21T09:00:00"));
    const w1 = windows.find((w) => w.tier === "W1");
    expect(w1?.from).toBe("2026-04-27");
    expect(w1?.to).toBe("2026-05-03T23:59:59");
  });

  it("M1 covers the next month's ISO weeks not already owned by W1/W2 after dedup", () => {
    // First tick of Monday 2026-04-20 → M1 covers May 2026.
    // May 2026 ISO weeks: 18..22 (5 windows). W1 owns week 18, W2 owns week 19.
    // After dedup M1 should keep weeks 20, 21, 22 (3 windows).
    const windows = selectWindowsForTick(chileTime("2026-04-20T09:00:00"));
    const m1 = windows.filter((w) => w.tier === "M1");
    expect(m1.map((w) => w.from)).toEqual(["2026-05-11", "2026-05-18", "2026-05-25"]);
    for (const win of m1) {
      expect(win.to.endsWith("T23:59:59")).toBe(true);
    }
  });
});

describe("selectWindowsForTick — dedup", () => {
  it("deduplicates overlapping windows across tiers", () => {
    // Every tick returns unique from+to pairs.
    const now = chileTime("2026-04-20T09:00:00");
    const windows = selectWindowsForTick(now);
    const keys = new Set<string>();
    for (const w of windows) {
      const key = `${w.from}|${w.to}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
  });
});
