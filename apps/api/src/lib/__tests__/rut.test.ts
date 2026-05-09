import { describe, expect, it } from "vitest";
import {
  canonicalRutFilter,
  formatRut,
  normalizeRut,
  requireCanonicalRut,
  validateRut,
} from "../rut";

describe("rut", () => {
  describe("normalizeRut", () => {
    it("normalizes a clean RUT string", () => {
      expect(normalizeRut("12345678-9")).toBe("12345678-9");
    });

    it("normalizes a RUT with dots", () => {
      expect(normalizeRut("12.345.678-9")).toBe("12345678-9");
    });

    it("normalizes a RUT with K digit (uppercase)", () => {
      expect(normalizeRut("11222333-K")).toBe("11222333-K");
    });

    it("normalizes a RUT with k digit (lowercase, converts to uppercase)", () => {
      expect(normalizeRut("11222333-k")).toBe("11222333-K");
    });

    it("strips all non-digit and non-K characters", () => {
      expect(normalizeRut("  12.345.678 - 9  ")).toBe("12345678-9");
    });

    it("removes leading zeros in body", () => {
      expect(normalizeRut("00012345-6")).toBe("12345-6");
    });

    it("returns null for null input", () => {
      expect(normalizeRut(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(normalizeRut(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(normalizeRut("")).toBeNull();
    });

    it("returns null for string with only special characters", () => {
      expect(normalizeRut("---")).toBeNull();
    });

    it("returns null for body that is not numeric", () => {
      // After cleaning non-digit/non-K chars, if body portion contains K it's invalid
      expect(normalizeRut("K-9")).toBeNull();
    });

    it("handles single-digit RUT body", () => {
      expect(normalizeRut("1-9")).toBe("1-9");
    });

    it("handles RUT without dash", () => {
      expect(normalizeRut("123456789")).toBe("12345678-9");
    });
  });

  describe("validateRut", () => {
    // Check digits verified via the algorithm: body 12345678 -> dv 5
    it("validates a known valid RUT 12.345.678-5", () => {
      expect(validateRut("12345678-5")).toBe(true);
    });

    // body 5126663 -> dv 3
    it("validates a RUT with numeric check digit 5.126.663-3", () => {
      expect(validateRut("5126663-3")).toBe(true);
    });

    it("validates with dots and dash formatting", () => {
      expect(validateRut("5.126.663-3")).toBe(true);
    });

    it("rejects a RUT with wrong check digit", () => {
      expect(validateRut("12345678-0")).toBe(false);
    });

    it("rejects null", () => {
      expect(validateRut(null)).toBe(false);
    });

    it("rejects undefined", () => {
      expect(validateRut(undefined)).toBe(false);
    });

    it("rejects empty string", () => {
      expect(validateRut("")).toBe(false);
    });

    it("rejects garbage string", () => {
      expect(validateRut("not-a-rut")).toBe(false);
    });

    // body 76354771 -> dv K
    it("validates RUT with K check digit: 76.354.771-K", () => {
      expect(validateRut("76354771-K")).toBe(true);
    });

    it("validates K check digit case-insensitively: 76.354.771-k", () => {
      expect(validateRut("76354771-k")).toBe(true);
    });

    it("rejects RUT where check digit is K but calculated is numeric", () => {
      expect(validateRut("12345678-K")).toBe(false);
    });

    // body 10000004 -> dv 0 (mod=11 edge case)
    it("validates RUT with dv=0 (mod=11 case): 10.000.004-0", () => {
      expect(validateRut("10000004-0")).toBe(true);
    });

    // body 11222333 -> dv 9
    it("validates RUT 11.222.333-9", () => {
      expect(validateRut("11222333-9")).toBe(true);
    });
  });

  describe("requireCanonicalRut", () => {
    it("returns canonical form for dotted input", () => {
      expect(requireCanonicalRut("20.275.995-5")).toBe("20275995-5");
    });

    it("returns canonical form when already canonical", () => {
      expect(requireCanonicalRut("20275995-5")).toBe("20275995-5");
    });

    it("uppercases K check digit", () => {
      expect(requireCanonicalRut("11222333-k")).toBe("11222333-K");
    });

    it("strips whitespace and dots", () => {
      expect(requireCanonicalRut("  20.275.995 - 5  ")).toBe("20275995-5");
    });

    it("throws on null", () => {
      expect(() => requireCanonicalRut(null)).toThrow();
    });

    it("throws on undefined", () => {
      expect(() => requireCanonicalRut(undefined)).toThrow();
    });

    it("throws on empty string", () => {
      expect(() => requireCanonicalRut("")).toThrow();
    });

    it("throws on garbage input", () => {
      expect(() => requireCanonicalRut("---")).toThrow();
    });

    it("preserves identity across the helper boundary (idempotent)", () => {
      const once = requireCanonicalRut("20.275.995-5");
      const twice = requireCanonicalRut(once);
      expect(once).toBe(twice);
    });
  });

  describe("canonicalRutFilter", () => {
    it("returns canonical form for dotted input", () => {
      expect(canonicalRutFilter("20.275.995-5")).toBe("20275995-5");
    });

    it("returns canonical form when already canonical", () => {
      expect(canonicalRutFilter("20275995-5")).toBe("20275995-5");
    });

    it("returns null on null/undefined/empty", () => {
      expect(canonicalRutFilter(null)).toBeNull();
      expect(canonicalRutFilter(undefined)).toBeNull();
      expect(canonicalRutFilter("")).toBeNull();
    });

    it("returns null on non-RUT garbage so DB filters match nothing", () => {
      expect(canonicalRutFilter("---")).toBeNull();
      expect(canonicalRutFilter("abc")).toBeNull();
    });

    it("treats whitespace-trimming inputs equivalently", () => {
      expect(canonicalRutFilter("20.275.995-5")).toBe(canonicalRutFilter("20275995-5"));
      expect(canonicalRutFilter(" 20.275.995-5 ")).toBe(canonicalRutFilter("20275995-5"));
    });
  });

  describe("formatRut", () => {
    it("formats a plain RUT with dots and dash", () => {
      expect(formatRut("12345678-9")).toBe("12.345.678-9");
    });

    it("formats a RUT with K check digit", () => {
      expect(formatRut("5126663-K")).toBe("5.126.663-K");
    });

    it("formats a RUT already with dots", () => {
      expect(formatRut("12.345.678-9")).toBe("12.345.678-9");
    });

    it("returns empty string for null", () => {
      expect(formatRut(null)).toBe("");
    });

    it("returns empty string for undefined", () => {
      expect(formatRut(undefined)).toBe("");
    });

    it("returns empty string for empty string", () => {
      expect(formatRut("")).toBe("");
    });

    it("formats a small RUT body correctly (no dots needed)", () => {
      expect(formatRut("123-6")).toBe("123-6");
    });

    it("formats a 7-digit body with one dot", () => {
      expect(formatRut("1234567-8")).toBe("1.234.567-8");
    });

    it("formats a 6-digit body with one dot", () => {
      expect(formatRut("123456-7")).toBe("123.456-7");
    });
  });
});
