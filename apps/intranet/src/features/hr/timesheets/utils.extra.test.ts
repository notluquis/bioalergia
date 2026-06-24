import { describe, expect, it } from "vitest";

import type { BulkRow, TimesheetSummaryRow } from "./types";
import {
  calculateWorkedMinutes,
  computeExtraAmount,
  computeStatus,
  formatDateLabel,
  formatExtraHours,
  formatTotalExtraHours,
  hasRowData,
  isBulkRowsDirty,
  isRowDirty,
  isValidTimeString,
  minutesToDuration,
  parseDuration,
} from "./utils";

function row(overrides: Partial<BulkRow> = {}): BulkRow {
  return {
    comment: "",
    date: new Date("2026-01-01T00:00:00"),
    entrada: "",
    entryId: null,
    overtime: "",
    salida: "",
    ...overrides,
  };
}

describe("hr/timesheets/utils extra", () => {
  describe("calculateWorkedMinutes", () => {
    it("returns 0 for empty inputs", () => {
      expect(calculateWorkedMinutes("", "")).toBe(0);
      expect(calculateWorkedMinutes("00:00", "10:00")).toBe(0);
    });
    it("computes positive duration", () => {
      expect(calculateWorkedMinutes("09:00", "17:30")).toBe(510);
    });
    it("handles cross-midnight ranges", () => {
      expect(calculateWorkedMinutes("22:00", "06:00")).toBe(8 * 60);
    });
    it("returns 0 on invalid time", () => {
      expect(calculateWorkedMinutes("abc", "12:00")).toBe(0);
    });
  });

  describe("computeExtraAmount", () => {
    it("returns 0 when rate or minutes missing", () => {
      expect(computeExtraAmount(0, 1000)).toBe(0);
      expect(computeExtraAmount(60, 0)).toBe(0);
    });
    it("computes pay for extra minutes", () => {
      expect(computeExtraAmount(60, 1000)).toBe(1000);
      expect(computeExtraAmount(30, 1000)).toBe(500);
    });
  });

  describe("computeStatus", () => {
    it("Registrado when entryId and not dirty", () => {
      expect(computeStatus(row({ entryId: 1 }), false)).toBe("Registrado");
    });
    it("Sin guardar when dirty with entryId", () => {
      expect(computeStatus(row({ entryId: 1 }), true)).toBe("Sin guardar");
    });
    it("Sin guardar for new row with data", () => {
      expect(computeStatus(row({ entrada: "09:00" }), false)).toBe("Sin guardar");
    });
    it("No trabajado for empty new row", () => {
      expect(computeStatus(row(), false)).toBe("No trabajado");
    });
  });

  describe("hasRowData", () => {
    it("detects non-empty fields", () => {
      expect(hasRowData(row())).toBe(false);
      expect(hasRowData(row({ comment: "x" }))).toBe(true);
    });
  });

  describe("formatDateLabel", () => {
    it("returns dash for null", () => {
      expect(formatDateLabel(null)).toBe("—");
    });
    it("formats valid date", () => {
      expect(formatDateLabel("2026-01-15")).toBe("15-01-2026");
    });
    it("returns string for invalid", () => {
      expect(formatDateLabel("not-a-date")).toBe("not-a-date");
    });
  });

  describe("formatExtraHours / formatTotalExtraHours", () => {
    function summary(over: Partial<TimesheetSummaryRow> = {}): TimesheetSummaryRow {
      return {
        extraAmount: 0,
        overtimeMinutes: 0,
        overtimeRate: 0,
        ...over,
      } as TimesheetSummaryRow;
    }
    it("returns 00:00 with no extra amount", () => {
      expect(formatExtraHours(summary())).toBe("00:00");
    });
    it("computes from rate", () => {
      expect(formatExtraHours(summary({ extraAmount: 1000, overtimeRate: 1000 }))).toBe("01:00");
    });
    it("falls back to overtimeMinutes when rate is 0", () => {
      expect(formatExtraHours(summary({ extraAmount: 100, overtimeMinutes: 30 }))).toBe("00:30");
    });
    it("totals across rows", () => {
      const total = formatTotalExtraHours([
        summary({ extraAmount: 1000, overtimeRate: 1000 }),
        summary({ extraAmount: 500, overtimeRate: 1000 }),
      ]);
      expect(total).toBe("01:30");
    });
    it("ignores rows without extraAmount in total", () => {
      expect(formatTotalExtraHours([summary()])).toBe("00:00");
    });
  });

  describe("minutesToDuration", () => {
    it("formats positive", () => {
      expect(minutesToDuration(75)).toBe("01:15");
    });
    it("handles negative recursively", () => {
      expect(minutesToDuration(-90)).toBe("-01:30");
    });
  });

  describe("parseDuration", () => {
    it("returns 0 for empty", () => {
      expect(parseDuration("")).toBe(0);
    });
    it("rejects invalid format", () => {
      expect(parseDuration("abc")).toBeNull();
    });
    it("rejects minutes >=60", () => {
      expect(parseDuration("1:75")).toBeNull();
    });
    it("rejects seconds >=60", () => {
      expect(parseDuration("1:00:99")).toBeNull();
    });
    it("parses HH:MM", () => {
      expect(parseDuration("02:30")).toBe(150);
    });
  });

  describe("isValidTimeString", () => {
    it("accepts HH:MM", () => {
      expect(isValidTimeString("09:30")).toBe(true);
    });
    it("rejects garbage", () => {
      expect(isValidTimeString("nope")).toBe(false);
    });
  });

  describe("dirty checks", () => {
    it("isRowDirty without initial", () => {
      expect(isRowDirty(row({ entrada: "09:00" }))).toBe(true);
      expect(isRowDirty(row())).toBe(false);
    });
    it("isRowDirty with initial", () => {
      const a = row({ entrada: "09:00" });
      const b = row({ entrada: "10:00" });
      expect(isRowDirty(a, b)).toBe(true);
      expect(isRowDirty(a, a)).toBe(false);
    });
    it("isBulkRowsDirty detects length differences", () => {
      expect(isBulkRowsDirty([row()], [])).toBe(true);
    });
    it("isBulkRowsDirty detects field changes", () => {
      const a = row({ entrada: "09:00" });
      const b = row({ entrada: "10:00" });
      expect(isBulkRowsDirty([a], [b])).toBe(true);
    });
    it("isBulkRowsDirty false when identical", () => {
      const a = row({ entrada: "09:00" });
      expect(isBulkRowsDirty([a], [{ ...a }])).toBe(false);
    });
  });
});
