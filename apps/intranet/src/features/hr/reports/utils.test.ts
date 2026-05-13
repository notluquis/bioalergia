import { describe, expect, it } from "vitest";

import type { TimesheetEntry } from "../timesheets/types";
import type { EmployeeWorkData } from "./types";
import {
  calculateStats,
  groupByDay,
  groupByMonth,
  groupByWeek,
  minutesToTime,
  prepareChartData,
  prepareComparisonData,
  processEmployeeData,
} from "./utils";

function entry(work_date: string, worked_minutes: number, overtime_minutes = 0): TimesheetEntry {
  return {
    comment: null,
    employee_id: 1,
    end_time: "18:00",
    id: 1,
    overtime_minutes,
    start_time: "09:00",
    work_date,
    worked_minutes,
  };
}

function emp(name: string, totalMinutes: number, overrides: Partial<EmployeeWorkData> = {}): EmployeeWorkData {
  return {
    avgDailyMinutes: 0,
    dailyBreakdown: {},
    employeeId: 1,
    fullName: name,
    monthlyBreakdown: {},
    monthlyGrossSalary: {},
    monthlyNetSalary: {},
    overtimePercentage: 0,
    role: "any",
    totalDays: 1,
    totalMinutes,
    totalOvertimeMinutes: 0,
    weeklyBreakdown: {},
    ...overrides,
  };
}

describe("hr/reports/utils", () => {
  describe("calculateStats", () => {
    it("returns null on empty data", () => {
      expect(calculateStats([])).toBeNull();
    });
    it("computes totals/averages and min/max", () => {
      const data = [emp("A", 600), emp("B", 1200)];
      const stats = calculateStats(data, 1);
      expect(stats?.totalHours).toBe(30);
      expect(stats?.averageHours).toBe(15);
      expect(stats?.maxEmployee.name).toBe("B");
      expect(stats?.minEmployee.name).toBe("A");
    });
    it("uses periodCount in averaging", () => {
      const stats = calculateStats([emp("A", 1200)], 2);
      expect(stats?.averageHours).toBe(10);
    });
  });

  describe("groupBy*", () => {
    const entries = [entry("2026-01-01", 60), entry("2026-01-01", 30), entry("2026-01-08", 90)];
    it("groups by day", () => {
      expect(groupByDay(entries)).toEqual({ "2026-01-01": 90, "2026-01-08": 90 });
    });
    it("groups by month", () => {
      expect(groupByMonth(entries)).toEqual({ "2026-01": 180 });
    });
    it("groups by ISO week", () => {
      const out = groupByWeek(entries);
      expect(Object.values(out).reduce((a, b) => a + b, 0)).toBe(180);
    });
  });

  describe("minutesToTime", () => {
    it("formats H:MM with padding", () => {
      expect(minutesToTime(0)).toBe("0:00");
      expect(minutesToTime(75)).toBe("1:15");
    });
  });

  describe("processEmployeeData", () => {
    it("computes totals and breakdowns", () => {
      const out = processEmployeeData(7, "Alice", "doc", [
        entry("2026-01-01", 60, 10),
        entry("2026-01-02", 120, 0),
      ]);
      expect(out.totalMinutes).toBe(180);
      expect(out.totalDays).toBe(2);
      expect(out.totalOvertimeMinutes).toBe(10);
      expect(out.avgDailyMinutes).toBe(90);
      expect(out.fullName).toBe("Alice");
    });
    it("includes salary summary when provided", () => {
      const out = processEmployeeData(1, "B", "r", [], [
        { month: "2026-01", net: 100, retention: 10, subtotal: 200 },
      ]);
      expect(out.monthlyGrossSalary).toEqual({ "2026-01": 200 });
      expect(out.monthlyNetSalary).toEqual({ "2026-01": 100 });
      expect(out.overtimePercentage).toBe(0);
    });
  });

  describe("prepareChartData", () => {
    it("converts breakdown to chart points", () => {
      const e = emp("X", 120, { dailyBreakdown: { "2026-01-01": 60 } });
      const points = prepareChartData(e, "day");
      expect(points).toEqual([
        { X: 1, minutes: 60, period: "2026-01-01" },
      ]);
    });
  });

  describe("prepareComparisonData", () => {
    it("returns empty for no employees", () => {
      expect(prepareComparisonData([], "day")).toEqual([]);
    });
    it("merges periods across employees and includes salary suffixes", () => {
      const e1 = emp("A", 60, {
        monthlyBreakdown: { "2026-01": 60 },
        monthlyGrossSalary: { "2026-01": 1000 },
        monthlyNetSalary: { "2026-01": 900 },
      });
      const e2 = emp("B", 120, {
        monthlyBreakdown: { "2026-02": 120 },
      });
      const out = prepareComparisonData([e1, e2], "month");
      expect(out).toHaveLength(2);
      const jan = out.find((d) => d.period === "2026-01");
      expect(jan?.A_gross).toBe(1000);
      expect(jan?.A_net).toBe(900);
    });
  });
});
