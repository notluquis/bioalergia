import { describe, expect, it } from "vitest";
import {
  formatRetentionPercent,
  getEffectiveRetentionRate,
  getRetentionRateForYear,
} from "../retention.ts";

describe("retention", () => {
  describe("getRetentionRateForYear", () => {
    it("returns 14.5% for 2025", () => {
      expect(getRetentionRateForYear(2025)).toBe(0.145);
    });

    it("returns 14.5% for years before 2025", () => {
      expect(getRetentionRateForYear(2024)).toBe(0.145);
      expect(getRetentionRateForYear(2020)).toBe(0.145);
      expect(getRetentionRateForYear(2000)).toBe(0.145);
    });

    it("returns 15.25% for 2026", () => {
      expect(getRetentionRateForYear(2026)).toBe(0.1525);
    });

    it("returns 15.25% for years after 2026", () => {
      expect(getRetentionRateForYear(2027)).toBe(0.1525);
      expect(getRetentionRateForYear(2030)).toBe(0.1525);
    });

    it("boundary: 2025 is still old rate", () => {
      expect(getRetentionRateForYear(2025)).toBe(0.145);
    });

    it("boundary: 2026 is new rate", () => {
      expect(getRetentionRateForYear(2026)).toBe(0.1525);
    });
  });

  describe("getEffectiveRetentionRate", () => {
    it("uses year rate when employee rate is null", () => {
      expect(getEffectiveRetentionRate(null, 2025)).toBe(0.145);
      expect(getEffectiveRetentionRate(null, 2026)).toBe(0.1525);
    });

    it("uses year rate when employee rate is undefined", () => {
      expect(getEffectiveRetentionRate(undefined, 2025)).toBe(0.145);
      expect(getEffectiveRetentionRate(undefined, 2026)).toBe(0.1525);
    });

    it("uses year rate when employee rate is 0", () => {
      expect(getEffectiveRetentionRate(0, 2025)).toBe(0.145);
    });

    it("uses year rate when employee has the 14.5% default", () => {
      expect(getEffectiveRetentionRate(0.145, 2026)).toBe(0.1525);
    });

    it("uses year rate when employee has the 15.25% default", () => {
      expect(getEffectiveRetentionRate(0.1525, 2025)).toBe(0.145);
    });

    it("uses custom rate when employee has a non-default rate", () => {
      expect(getEffectiveRetentionRate(0.12, 2025)).toBe(0.12);
      expect(getEffectiveRetentionRate(0.12, 2026)).toBe(0.12);
    });

    it("uses custom rate 0.20 regardless of year", () => {
      expect(getEffectiveRetentionRate(0.2, 2024)).toBe(0.2);
      expect(getEffectiveRetentionRate(0.2, 2027)).toBe(0.2);
    });

    it("uses custom rate 0.10 regardless of year", () => {
      expect(getEffectiveRetentionRate(0.1, 2025)).toBe(0.1);
    });
  });

  describe("formatRetentionPercent", () => {
    it("formats 14.5% correctly", () => {
      expect(formatRetentionPercent(0.145)).toBe("14,5");
    });

    it("formats 15.25% correctly", () => {
      expect(formatRetentionPercent(0.1525)).toBe("15,3");
    });

    it("formats 0% correctly", () => {
      expect(formatRetentionPercent(0)).toBe("0,0");
    });

    it("formats 100% correctly", () => {
      expect(formatRetentionPercent(1)).toBe("100,0");
    });

    it("formats 12% correctly", () => {
      expect(formatRetentionPercent(0.12)).toBe("12,0");
    });

    it("uses comma as decimal separator", () => {
      const result = formatRetentionPercent(0.145);
      expect(result).toContain(",");
      expect(result).not.toContain(".");
    });

    it("always returns one decimal place", () => {
      expect(formatRetentionPercent(0.2)).toBe("20,0");
      expect(formatRetentionPercent(0.155)).toBe("15,5");
    });
  });
});
