import { describe, expect, it } from "vitest";

import {
  addDays,
  diffDays,
  endOfMonth,
  endOfMonthFor,
  endOfYear,
  formatChile,
  formatISO,
  getISOWeek,
  getISOWeekYear,
  ISO_DATE_FORMAT,
  daysAgo,
  monthsAgoEnd,
  monthsAgoStart,
  startOfMonth,
  startOfMonthFor,
  startOfYear,
  today,
} from "./dates";

const ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const chileToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

describe("ISO_DATE_FORMAT", () => {
  it("equals 'YYYY-MM-DD'", () => {
    expect(ISO_DATE_FORMAT).toBe("YYYY-MM-DD");
  });
});

describe("today / daysAgo", () => {
  it("today is the Chile calendar day", () => {
    expect(today()).toMatch(ISO_REGEX);
    expect(today()).toBe(chileToday());
  });

  it("daysAgo(0) === today, daysAgo(7) is 7 days earlier", () => {
    expect(daysAgo(0)).toBe(today());
    expect(diffDays(today(), daysAgo(7))).toBe(7);
  });
});

describe("startOfMonth / endOfMonth", () => {
  it("startOfMonth is the first day of the current month", () => {
    expect(startOfMonth()).toBe(`${today().slice(0, 7)}-01`);
    expect(startOfMonth().endsWith("-01")).toBe(true);
  });

  it("endOfMonth is in the current month and after startOfMonth", () => {
    expect(endOfMonth().slice(0, 7)).toBe(today().slice(0, 7));
    expect(endOfMonth() >= startOfMonth()).toBe(true);
  });
});

describe("startOfMonthFor / endOfMonthFor", () => {
  it("first/last day of a given month string", () => {
    expect(startOfMonthFor("2024-03-15")).toBe("2024-03-01");
    expect(endOfMonthFor("2024-02-10")).toBe("2024-02-29"); // leap year
    expect(endOfMonthFor("2023-02-05")).toBe("2023-02-28");
    expect(endOfMonthFor("2025-07-20")).toBe("2025-07-31");
  });

  it("accepts a Date", () => {
    expect(startOfMonthFor(new Date("2025-07-20T12:00:00Z"))).toBe("2025-07-01");
  });
});

describe("startOfYear / endOfYear", () => {
  it("Jan 1 / Dec 31 of the current Chile year", () => {
    const year = today().slice(0, 4);
    expect(startOfYear()).toBe(`${year}-01-01`);
    expect(endOfYear()).toBe(`${year}-12-31`);
  });
});

describe("monthsAgoStart / monthsAgoEnd", () => {
  it("0 months === current month bounds", () => {
    expect(monthsAgoStart(0)).toBe(startOfMonth());
    expect(monthsAgoEnd(0)).toBe(endOfMonth());
  });

  it("1 month ago is the previous month", () => {
    expect(monthsAgoStart(1).endsWith("-01")).toBe(true);
    expect(monthsAgoStart(1) < startOfMonth()).toBe(true);
  });
});

describe("formatISO", () => {
  it("formats a Date / string to YYYY-MM-DD", () => {
    expect(formatISO(new Date("2023-06-15T12:00:00Z"))).toBe("2023-06-15");
    expect(formatISO("2025-11-03")).toBe("2025-11-03");
    expect(formatISO("2020-12-31")).toMatch(ISO_REGEX);
  });
});

describe("addDays / diffDays (DST-safe)", () => {
  it("crosses month/DST boundaries correctly", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29"); // leap
    expect(diffDays("2026-03-15", "2026-03-01")).toBe(14);
    // Chile DST transition (first Sunday of April / September) — still exact.
    expect(diffDays("2026-04-10", "2026-04-01")).toBe(9);
    expect(diffDays("2026-09-10", "2026-09-01")).toBe(9);
  });
});

describe("formatChile (token shim)", () => {
  const d = new Date("2026-03-09T18:45:30Z"); // Monday, 15:45 Chile
  it.each([
    ["DD/MM/YYYY HH:mm", "09/03/2026 15:45"],
    ["DD MMM YYYY", "09 mar 2026"],
    ["dddd D [de] MMMM", "lunes 9 de marzo"],
    ["MMMM YYYY", "marzo 2026"],
  ])("formats %s -> %s", (pattern, expected) => {
    expect(formatChile(d, pattern)).toBe(expected);
  });

  it("ddd is the short weekday (trailing period is ICU/browser-dependent)", () => {
    expect(formatChile(d, "ddd")).toMatch(/^lun\.?$/);
  });

  it("anchors a bare YYYY-MM-DD at the same calendar day", () => {
    expect(formatChile("2026-03-09", "DD/MM/YYYY")).toBe("09/03/2026");
  });
});

describe("getISOWeek / getISOWeekYear", () => {
  it("ISO-8601 week + week-year at boundaries", () => {
    expect(getISOWeek("2026-01-01")).toBe(1);
    expect(getISOWeek("2024-12-30")).toBe(1);
    expect(getISOWeekYear("2024-12-30")).toBe(2025);
    expect(getISOWeek("2027-01-01")).toBe(53);
    expect(getISOWeekYear("2027-01-01")).toBe(2026);
  });
});
