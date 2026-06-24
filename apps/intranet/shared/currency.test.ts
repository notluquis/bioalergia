import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";

import { addCurrency, roundCurrency, subtractCurrency, toDecimal } from "./currency";

describe("shared/currency", () => {
  describe("toDecimal", () => {
    it("returns zero for null/undefined", () => {
      expect(toDecimal(null).toNumber()).toBe(0);
      expect(toDecimal(undefined).toNumber()).toBe(0);
    });
    it("returns same Decimal instance", () => {
      const d = new Decimal(42);
      expect(toDecimal(d)).toBe(d);
    });
    it("parses numbers and numeric strings", () => {
      expect(toDecimal(10).toNumber()).toBe(10);
      expect(toDecimal("3.5").toNumber()).toBe(3.5);
    });
    it("returns zero for unparseable input", () => {
      expect(toDecimal("not-a-number").toNumber()).toBe(0);
      expect(toDecimal({} as never).toNumber()).toBe(0);
    });
  });

  describe("addCurrency", () => {
    it("adds and rounds", () => {
      expect(addCurrency(1.4, 1.2)).toBe(3);
      expect(addCurrency("100", "50")).toBe(150);
    });
    it("handles null operands", () => {
      expect(addCurrency(null, 5)).toBe(5);
    });
  });

  describe("subtractCurrency", () => {
    it("subtracts and rounds", () => {
      expect(subtractCurrency(10, 3)).toBe(7);
      expect(subtractCurrency("10.6", "0.4")).toBe(10);
    });
  });

  describe("roundCurrency", () => {
    it("rounds half-up", () => {
      expect(roundCurrency(1.5)).toBe(2);
      expect(roundCurrency(1.4)).toBe(1);
    });
    it("returns 0 for null", () => {
      expect(roundCurrency(null)).toBe(0);
    });
  });
});
