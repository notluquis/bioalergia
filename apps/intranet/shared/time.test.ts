import { describe, expect, it } from "vitest";

import {
  durationToMinutes,
  minutesToDuration,
  minutesToTime,
  parseTimeToMinutes,
} from "./time";

describe("shared/time", () => {
  describe("durationToMinutes", () => {
    it("returns 0 for empty string", () => {
      expect(durationToMinutes("")).toBe(0);
    });
    it("parses HH:MM", () => {
      expect(durationToMinutes("01:30")).toBe(90);
      expect(durationToMinutes("10:00")).toBe(600);
    });
    it("returns 0 for invalid number parts", () => {
      expect(durationToMinutes("ab:cd")).toBe(0);
    });
    it("handles missing minutes part", () => {
      expect(durationToMinutes("2")).toBe(120);
    });
  });

  describe("minutesToDuration", () => {
    it("formats positive minutes", () => {
      expect(minutesToDuration(0)).toBe("0:00");
      expect(minutesToDuration(75)).toBe("1:15");
    });
    it("handles negative minutes with sign", () => {
      expect(minutesToDuration(-90)).toBe("-1:30");
    });
    it("returns 0:00 for non-finite", () => {
      expect(minutesToDuration(Number.POSITIVE_INFINITY)).toBe("0:00");
      expect(minutesToDuration(Number.NaN)).toBe("0:00");
    });
    it("rounds fractional minutes", () => {
      expect(minutesToDuration(60.6)).toBe("1:01");
    });
  });

  describe("minutesToTime", () => {
    it("returns null for null/non-finite", () => {
      expect(minutesToTime(null)).toBeNull();
      expect(minutesToTime(Number.NaN)).toBeNull();
    });
    it("formats minutes within 24h", () => {
      expect(minutesToTime(0)).toBe("00:00");
      expect(minutesToTime(125)).toBe("02:05");
    });
    it("wraps around 24h", () => {
      expect(minutesToTime(24 * 60)).toBe("00:00");
      expect(minutesToTime(25 * 60 + 30)).toBe("01:30");
    });
  });

  describe("parseTimeToMinutes", () => {
    it("returns null for empty string", () => {
      expect(parseTimeToMinutes("")).toBeNull();
    });
    it("parses HH:MM", () => {
      expect(parseTimeToMinutes("09:30")).toBe(570);
    });
    it("returns null when missing parts", () => {
      expect(parseTimeToMinutes("12")).toBeNull();
    });
    it("returns null for non-numeric parts", () => {
      expect(parseTimeToMinutes("aa:bb")).toBeNull();
    });
  });
});
