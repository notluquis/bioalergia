import { describe, expect, it } from "vitest";

import { formatRut, normalizeRut, validateRut } from "./rut";

describe("rut.ts uncovered branches", () => {
  describe("normalizeRut", () => {
    it("returns null when only non-numeric body remains (line 27-28)", () => {
      // dv = "K", but body = "" → null. "K" alone has body "" after slice.
      expect(normalizeRut("K")).toBeNull();
    });

    it("returns null when body has no digits but contains valid chars", () => {
      // "-K" cleans to "K" → body = "" → null
      expect(normalizeRut("-K")).toBeNull();
    });

    it("strips dots / spaces / dashes consistently", () => {
      expect(normalizeRut("  12.345.678 - 5  ")).toBe("12345678-5");
    });

    it("returns null when only symbols supplied", () => {
      expect(normalizeRut(".-")).toBeNull();
    });
  });

  describe("formatRut", () => {
    it("returns single char unchanged when length < 2 (line 9)", () => {
      expect(formatRut("5")).toBe("5");
    });

    it("returns cleaned value when body is non-numeric", () => {
      // "KK" cleans to "KK"; body "K" not numeric → returns cleaned
      expect(formatRut("KK")).toBe("KK");
    });

    it("returns empty string when value is null", () => {
      expect(formatRut(null)).toBe("");
    });

    it("returns empty string when value is undefined", () => {
      expect(formatRut()).toBe("");
    });
  });

  describe("validateRut", () => {
    it("validates RUT where check digit is 0 (remainder === 11, line 54-55)", () => {
      // body=10000200, reversed×mults [2,3,4,5,6,7,2,3] = 0+6+0+0+0+0+0+3+... actually:
      // digits reversed: 0,0,2,0,0,0,0,1; mults: 2,3,4,5,6,7,2,3
      // sum = 0+0+8+0+0+0+0+3 = 11; 11 % 11 = 0; 11 - 0 = 11 -> "0"
      expect(validateRut("10.000.200-0")).toBe(true);
    });

    it("validates K when remainder === 10", () => {
      // body = 6 → 6*2 = 12 → 11 - (12 % 11) = 11 - 1 = 10 → "K"
      expect(validateRut("6-K")).toBe(true);
    });

    it("rejects when check digit should be 0 but is K", () => {
      expect(validateRut("10.000.200-K")).toBe(false);
    });

    it("rejects null and undefined inputs", () => {
      expect(validateRut(null)).toBe(false);
      expect(validateRut()).toBe(false);
    });

    it("validates a known RUT with K dv from a longer body", () => {
      // 7.654.321-? → compute: digits 1,2,3,4,5,6,7 with multipliers 2,3,4,5,6,7,2
      // 1*2+2*3+3*4+4*5+5*6+6*7+7*2 = 2+6+12+20+30+42+14 = 126 → 11 - (126%11)=11-5=6 → "6"
      expect(validateRut("7.654.321-6")).toBe(true);
      expect(validateRut("7.654.321-7")).toBe(false);
    });
  });
});
