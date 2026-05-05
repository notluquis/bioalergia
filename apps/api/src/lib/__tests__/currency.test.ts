import { describe, expect, it } from "vitest";
import { addCurrency, roundCurrency } from "../currency";

describe("currency", () => {
  describe("roundCurrency", () => {
    it("returns whole number unchanged", () => {
      expect(roundCurrency(1000)).toBe(1000);
    });

    it("rounds 0.5 up", () => {
      expect(roundCurrency(100.5)).toBe(101);
    });

    it("rounds 0.4 down", () => {
      expect(roundCurrency(100.4)).toBe(100);
    });

    it("rounds negative values correctly", () => {
      expect(roundCurrency(-100.5)).toBe(-100);
      expect(roundCurrency(-100.6)).toBe(-101);
    });

    it("handles zero", () => {
      expect(roundCurrency(0)).toBe(0);
    });

    it("handles large values", () => {
      expect(roundCurrency(1_000_000.9)).toBe(1_000_001);
    });

    it("handles floating point arithmetic results", () => {
      // 0.1 + 0.2 = 0.30000000000000004 in JS
      expect(roundCurrency(0.1 + 0.2)).toBe(0);
    });

    it("rounds 1.5 to 2", () => {
      expect(roundCurrency(1.5)).toBe(2);
    });

    it("handles very small decimal", () => {
      expect(roundCurrency(999.01)).toBe(999);
    });
  });

  describe("addCurrency", () => {
    it("adds two whole numbers", () => {
      expect(addCurrency(100, 200)).toBe(300);
    });

    it("rounds the result after addition", () => {
      expect(addCurrency(100.3, 100.3)).toBe(201);
    });

    it("handles adding zero", () => {
      expect(addCurrency(500, 0)).toBe(500);
      expect(addCurrency(0, 500)).toBe(500);
    });

    it("handles negative addends", () => {
      expect(addCurrency(500, -200)).toBe(300);
      expect(addCurrency(-100, -200)).toBe(-300);
    });

    it("handles large amounts (CLP style)", () => {
      expect(addCurrency(1_500_000, 850_000)).toBe(2_350_000);
    });

    it("rounds fractional sum correctly", () => {
      expect(addCurrency(50.4, 50.4)).toBe(101);
    });

    it("returns 0 for 0 + 0", () => {
      expect(addCurrency(0, 0)).toBe(0);
    });

    it("result is always an integer", () => {
      const result = addCurrency(333.33, 333.33);
      expect(Number.isInteger(result)).toBe(true);
    });
  });
});
