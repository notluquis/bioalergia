import { describe, it, expect } from "vitest";
import { normalizeRut, formatRut, validateRut } from "./rut";

describe("RUT Utilities", () => {
  describe("normalizeRut", () => {
    it("should normalize a valid RUT with dots and dash", () => {
      expect(normalizeRut("12.345.678-5")).toBe("12345678-5");
    });

    it("should normalize a RUT without dots or dash", () => {
      expect(normalizeRut("123456785")).toBe("12345678-5");
    });

    it("should handle K check digit (uppercase)", () => {
      expect(normalizeRut("12.345.678-K")).toBe("12345678-K");
    });

    it("should handle k check digit (lowercase)", () => {
      expect(normalizeRut("12.345.678-k")).toBe("12345678-K");
    });

    it("should return null for empty input", () => {
      expect(normalizeRut("")).toBeNull();
      expect(normalizeRut(null)).toBeNull();
      expect(normalizeRut(undefined)).toBeNull();
    });

    it("should return null for invalid characters", () => {
      expect(normalizeRut("abc")).toBeNull();
    });
  });

  describe("formatRut", () => {
    it("should format a raw RUT", () => {
      expect(formatRut("123456785")).toBe("12.345.678-5");
    });

    it("should format an already formatted RUT", () => {
      expect(formatRut("12.345.678-5")).toBe("12.345.678-5");
    });

    it("should format a RUT with K", () => {
      expect(formatRut("12345678k")).toBe("12.345.678-K");
    });

    it("should return empty string for invalid input", () => {
      expect(formatRut("")).toBe("");
      expect(formatRut("invalid")).toBe("");
    });
  });

  describe("validateRut", () => {
    it("should return true for valid RUTs", () => {
      expect(validateRut("12.345.678-5")).toBe(true);
      expect(validateRut("11.111.111-1")).toBe(true);
    });

    it("should return true for valid RUT with K", () => {
      // 17.497.895-K is a valid example
      expect(validateRut("17.497.895-K")).toBe(true);
    });

    it("should return false for invalid check digit", () => {
      expect(validateRut("12.345.678-9")).toBe(false);
    });

    it("should return false for malformed input", () => {
      expect(validateRut("invalid")).toBe(false);
      expect(validateRut("")).toBe(false);
    });
  });
});
