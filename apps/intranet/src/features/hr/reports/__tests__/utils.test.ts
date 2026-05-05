import { describe, expect, it } from "vitest";
import type { TimesheetEntry } from "../../timesheets/types";
import {
  calculateStats,
  groupByDay,
  groupByMonth,
  groupByWeek,
  minutesToTime,
  processEmployeeData,
} from "../utils";

function makeEntry(overrides: Partial<TimesheetEntry> = {}): TimesheetEntry {
  return {
    id: 1,
    employee_id: 1,
    work_date: "2026-01-15",
    worked_minutes: 480,
    overtime_minutes: 0,
    start_time: "09:00",
    end_time: "17:00",
    comment: null,
    ...overrides,
  };
}

describe("minutesToTime", () => {
  it("converts full hours", () => {
    expect(minutesToTime(60)).toBe("1:00");
    expect(minutesToTime(480)).toBe("8:00");
  });

  it("pads minutes to two digits", () => {
    expect(minutesToTime(65)).toBe("1:05");
    expect(minutesToTime(90)).toBe("1:30");
  });

  it("handles zero", () => {
    expect(minutesToTime(0)).toBe("0:00");
  });

  it("handles large values", () => {
    expect(minutesToTime(1200)).toBe("20:00");
  });
});

describe("groupByDay", () => {
  it("sums minutes for the same day", () => {
    const entries = [
      makeEntry({ work_date: "2026-01-15", worked_minutes: 480 }),
      makeEntry({ work_date: "2026-01-15", worked_minutes: 60 }),
      makeEntry({ work_date: "2026-01-16", worked_minutes: 240 }),
    ];
    const result = groupByDay(entries);
    expect(result["2026-01-15"]).toBe(540);
    expect(result["2026-01-16"]).toBe(240);
  });

  it("returns empty object for empty entries", () => {
    expect(groupByDay([])).toEqual({});
  });
});

describe("groupByMonth", () => {
  it("groups and sums by YYYY-MM", () => {
    const entries = [
      makeEntry({ work_date: "2026-01-10", worked_minutes: 480 }),
      makeEntry({ work_date: "2026-01-20", worked_minutes: 480 }),
      makeEntry({ work_date: "2026-02-05", worked_minutes: 360 }),
    ];
    const result = groupByMonth(entries);
    expect(result["2026-01"]).toBe(960);
    expect(result["2026-02"]).toBe(360);
  });
});

describe("groupByWeek", () => {
  it("groups by ISO week with year prefix", () => {
    const entries = [
      makeEntry({ work_date: "2026-01-05" }), // Week 2
      makeEntry({ work_date: "2026-01-06" }), // Week 2
      makeEntry({ work_date: "2026-01-12" }), // Week 3
    ];
    const result = groupByWeek(entries);
    expect(result["2026-W02"]).toBe(960);
    expect(result["2026-W03"]).toBe(480);
  });
});

describe("calculateStats", () => {
  it("returns null for empty data", () => {
    expect(calculateStats([])).toBeNull();
  });

  it("computes totalHours, averageHours, max and min employees", () => {
    const data = [
      {
        employeeId: 1,
        fullName: "Ana",
        role: "nurse",
        totalMinutes: 2400,
        totalOvertimeMinutes: 0,
        totalDays: 5,
        avgDailyMinutes: 480,
        overtimePercentage: 0,
        dailyBreakdown: {},
        weeklyBreakdown: {},
        monthlyBreakdown: {},
        monthlyGrossSalary: {},
        monthlyNetSalary: {},
      },
      {
        employeeId: 2,
        fullName: "Luis",
        role: "doctor",
        totalMinutes: 1200,
        totalOvertimeMinutes: 0,
        totalDays: 3,
        avgDailyMinutes: 400,
        overtimePercentage: 0,
        dailyBreakdown: {},
        weeklyBreakdown: {},
        monthlyBreakdown: {},
        monthlyGrossSalary: {},
        monthlyNetSalary: {},
      },
    ];
    const stats = calculateStats(data);
    expect(stats).not.toBeNull();
    expect(stats?.totalHours).toBe(60);
    expect(stats?.maxEmployee.name).toBe("Ana");
    expect(stats?.minEmployee.name).toBe("Luis");
  });

  it("uses periodCount in average calculation", () => {
    const data = [
      {
        employeeId: 1,
        fullName: "Ana",
        role: "nurse",
        totalMinutes: 2400,
        totalOvertimeMinutes: 0,
        totalDays: 5,
        avgDailyMinutes: 480,
        overtimePercentage: 0,
        dailyBreakdown: {},
        weeklyBreakdown: {},
        monthlyBreakdown: {},
        monthlyGrossSalary: {},
        monthlyNetSalary: {},
      },
    ];
    const statsOne = calculateStats(data, 1);
    const statsTwo = calculateStats(data, 2);
    expect(statsTwo?.averageHours).toBe((statsOne?.averageHours ?? 0) / 2);
  });
});

describe("processEmployeeData", () => {
  it("computes total minutes and unique days", () => {
    const entries = [
      makeEntry({ work_date: "2026-01-10", worked_minutes: 480 }),
      makeEntry({ work_date: "2026-01-11", worked_minutes: 480 }),
    ];
    const result = processEmployeeData(1, "Ana García", "nurse", entries);
    expect(result.totalMinutes).toBe(960);
    expect(result.totalDays).toBe(2);
    expect(result.fullName).toBe("Ana García");
    expect(result.role).toBe("nurse");
  });

  it("computes overtime percentage", () => {
    const entries = [makeEntry({ worked_minutes: 480, overtime_minutes: 60 })];
    const result = processEmployeeData(1, "Ana", "nurse", entries);
    expect(result.overtimePercentage).toBeCloseTo(12.5, 1);
  });

  it("builds salary breakdowns from summary", () => {
    const entries = [makeEntry()];
    const salarySummary = [{ month: "2026-01", subtotal: 800000, net: 700000, retention: 100000 }];
    const result = processEmployeeData(1, "Ana", "nurse", entries, salarySummary);
    expect(result.monthlyGrossSalary["2026-01"]).toBe(800000);
    expect(result.monthlyNetSalary["2026-01"]).toBe(700000);
  });
});
