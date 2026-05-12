import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import {
  ISO_DATE_FORMAT,
  daysAgo,
  endOfMonth,
  endOfMonthFor,
  endOfYear,
  formatISO,
  monthsAgoEnd,
  monthsAgoStart,
  startOfMonth,
  startOfMonthFor,
  startOfYear,
  today,
} from "./dates";

const ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;

describe("ISO_DATE_FORMAT", () => {
  it("equals 'YYYY-MM-DD'", () => {
    expect(ISO_DATE_FORMAT).toBe("YYYY-MM-DD");
  });
});

describe("today", () => {
  it("returns a string in ISO format", () => {
    expect(today()).toMatch(ISO_REGEX);
  });

  it("matches the current date from dayjs", () => {
    expect(today()).toBe(dayjs().format("YYYY-MM-DD"));
  });
});

describe("daysAgo", () => {
  it("returns ISO string N days before today", () => {
    const result = daysAgo(7);
    expect(result).toMatch(ISO_REGEX);
    expect(result).toBe(dayjs().subtract(7, "day").format("YYYY-MM-DD"));
  });

  it("returns today when 0 days", () => {
    expect(daysAgo(0)).toBe(today());
  });

  it("returns correct date for 30 days ago", () => {
    expect(daysAgo(30)).toBe(dayjs().subtract(30, "day").format("YYYY-MM-DD"));
  });
});

describe("startOfMonth / endOfMonth", () => {
  it("startOfMonth returns first day of current month", () => {
    const result = startOfMonth();
    expect(result).toMatch(ISO_REGEX);
    expect(result).toBe(dayjs().startOf("month").format("YYYY-MM-DD"));
    expect(result.endsWith("-01")).toBe(true);
  });

  it("endOfMonth returns last day of current month", () => {
    const result = endOfMonth();
    expect(result).toMatch(ISO_REGEX);
    expect(result).toBe(dayjs().endOf("month").format("YYYY-MM-DD"));
  });

  it("startOfMonth day is always 01", () => {
    expect(startOfMonth().slice(-2)).toBe("01");
  });
});

describe("startOfMonthFor / endOfMonthFor", () => {
  it("startOfMonthFor returns first day of given month string", () => {
    expect(startOfMonthFor("2024-03-15")).toBe("2024-03-01");
  });

  it("endOfMonthFor returns last day of given month string", () => {
    expect(endOfMonthFor("2024-02-10")).toBe("2024-02-29"); // 2024 is leap year
  });

  it("endOfMonthFor returns 28 for non-leap February", () => {
    expect(endOfMonthFor("2023-02-05")).toBe("2023-02-28");
  });

  it("accepts a Dayjs object", () => {
    const date = dayjs("2025-07-20");
    expect(startOfMonthFor(date)).toBe("2025-07-01");
    expect(endOfMonthFor(date)).toBe("2025-07-31");
  });
});

describe("startOfYear / endOfYear", () => {
  it("startOfYear returns Jan 1 of current year", () => {
    const result = startOfYear();
    expect(result).toMatch(ISO_REGEX);
    const year = dayjs().year();
    expect(result).toBe(`${year}-01-01`);
  });

  it("endOfYear returns Dec 31 of current year", () => {
    const result = endOfYear();
    expect(result).toMatch(ISO_REGEX);
    const year = dayjs().year();
    expect(result).toBe(`${year}-12-31`);
  });
});

describe("monthsAgoStart / monthsAgoEnd", () => {
  it("monthsAgoStart returns first day of the month N months ago", () => {
    const result = monthsAgoStart(1);
    const expected = dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD");
    expect(result).toBe(expected);
    expect(result.slice(-2)).toBe("01");
  });

  it("monthsAgoEnd returns last day of the month N months ago", () => {
    const result = monthsAgoEnd(1);
    const expected = dayjs().subtract(1, "month").endOf("month").format("YYYY-MM-DD");
    expect(result).toBe(expected);
  });

  it("monthsAgoStart with 0 returns first day of current month", () => {
    expect(monthsAgoStart(0)).toBe(startOfMonth());
  });

  it("monthsAgoEnd with 0 returns last day of current month", () => {
    expect(monthsAgoEnd(0)).toBe(endOfMonth());
  });
});

describe("formatISO", () => {
  it("formats a Date object to ISO string", () => {
    const date = new Date("2023-06-15T12:00:00");
    expect(formatISO(date)).toBe("2023-06-15");
  });

  it("formats a date string to ISO format", () => {
    expect(formatISO("2025-11-03")).toBe("2025-11-03");
  });

  it("formats a Dayjs object", () => {
    expect(formatISO(dayjs("2024-01-20"))).toBe("2024-01-20");
  });

  it("returns ISO string matching the regex", () => {
    expect(formatISO("2020-12-31")).toMatch(ISO_REGEX);
  });
});
