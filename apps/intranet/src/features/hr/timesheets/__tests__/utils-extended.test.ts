import { describe, expect, it } from "vitest";
import {
  calculateWorkedMinutes,
  hasRowData,
  isValidTimeString,
  minutesToDuration,
  parseDuration,
} from "../utils";
import type { BulkRow } from "../types";

describe("minutesToDuration", () => {
  it("converts minutes to HH:MM string", () => {
    expect(minutesToDuration(90)).toBe("01:30");
    expect(minutesToDuration(60)).toBe("01:00");
    expect(minutesToDuration(0)).toBe("00:00");
  });

  it("handles negative minutes with leading minus", () => {
    expect(minutesToDuration(-30)).toBe("-00:30");
    expect(minutesToDuration(-90)).toBe("-01:30");
  });

  it("handles large values", () => {
    expect(minutesToDuration(480)).toBe("08:00");
  });
});

describe("parseDuration", () => {
  it("parses HH:MM string to total minutes", () => {
    expect(parseDuration("01:30")).toBe(90);
    expect(parseDuration("00:00")).toBe(0);
    expect(parseDuration("08:00")).toBe(480);
  });

  it("returns 0 for empty string", () => {
    expect(parseDuration("")).toBe(0);
  });

  it("returns null for invalid format", () => {
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("1:2:3:4")).toBeNull();
  });

  it("returns null for minutes >= 60", () => {
    expect(parseDuration("01:60")).toBeNull();
  });
});

describe("isValidTimeString", () => {
  it("accepts HH:MM format", () => {
    expect(isValidTimeString("09:00")).toBe(true);
    expect(isValidTimeString("23:59")).toBe(true);
  });

  it("rejects invalid strings", () => {
    expect(isValidTimeString("abc")).toBe(false);
    expect(isValidTimeString("")).toBe(false);
    expect(isValidTimeString("9:30")).toBe(false);
  });
});

describe("calculateWorkedMinutes", () => {
  it("calculates minutes between start and end", () => {
    expect(calculateWorkedMinutes("09:00", "17:00")).toBe(480);
  });

  it("returns 0 for empty strings", () => {
    expect(calculateWorkedMinutes("", "17:00")).toBe(0);
    expect(calculateWorkedMinutes("09:00", "")).toBe(0);
  });

  it("returns 0 for 00:00 sentinel values", () => {
    expect(calculateWorkedMinutes("00:00", "17:00")).toBe(0);
    expect(calculateWorkedMinutes("09:00", "00:00")).toBe(0);
  });

  it("handles overnight shift (end < start)", () => {
    const minutes = calculateWorkedMinutes("22:00", "06:00");
    expect(minutes).toBe(8 * 60);
  });
});

describe("hasRowData", () => {
  const emptyRow: BulkRow = {
    comment: "",
    date: new Date(),
    entrada: "",
    entryId: null,
    overtime: "",
    salida: "",
  };

  it("returns false for completely empty row", () => {
    expect(hasRowData(emptyRow)).toBe(false);
  });

  it("returns true when entrada is set", () => {
    expect(hasRowData({ ...emptyRow, entrada: "09:00" })).toBe(true);
  });

  it("returns true when comment is set", () => {
    expect(hasRowData({ ...emptyRow, comment: "holiday" })).toBe(true);
  });
});
