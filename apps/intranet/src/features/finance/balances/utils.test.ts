import { describe, expect, it } from "vitest";

import type { BalancesApiResponse } from "./types";
import { deriveInitialBalance, formatBalanceInput, parseBalanceInput } from "./utils";

function makeReport(overrides: Partial<BalancesApiResponse> = {}): BalancesApiResponse {
  return {
    days: [],
    previous: null,
    ...overrides,
  } as BalancesApiResponse;
}

describe("finance/balances/utils", () => {
  describe("deriveInitialBalance", () => {
    it("returns previous balance when present", () => {
      const r = makeReport({
        previous: { balance: 1000.4 },
      } as Partial<BalancesApiResponse>);
      expect(deriveInitialBalance(r)).toBe(1000);
    });

    it("derives from first day with recordedBalance", () => {
      const r = makeReport({
        days: [
          { netChange: 200, recordedBalance: 1500, expectedBalance: null },
        ],
      } as unknown as BalancesApiResponse);
      expect(deriveInitialBalance(r)).toBe(1300);
    });

    it("falls back to expectedBalance when no recorded balance", () => {
      const r = makeReport({
        days: [
          { netChange: 0, recordedBalance: null, expectedBalance: null },
          { netChange: 100, recordedBalance: null, expectedBalance: 500 },
        ],
      } as unknown as BalancesApiResponse);
      expect(deriveInitialBalance(r)).toBe(400);
    });

    it("returns null when no data available", () => {
      expect(deriveInitialBalance(makeReport())).toBeNull();
    });
  });

  describe("formatBalanceInput", () => {
    it("returns empty for non-finite", () => {
      expect(formatBalanceInput(Number.NaN)).toBe("");
      expect(formatBalanceInput(Number.POSITIVE_INFINITY)).toBe("");
    });
    it("returns integer string when value rounds to integer", () => {
      expect(formatBalanceInput(1000)).toBe("1000");
      expect(formatBalanceInput(1000.4)).toBe("1000");
    });
  });

  describe("parseBalanceInput", () => {
    it("returns null for empty/whitespace", () => {
      expect(parseBalanceInput("")).toBeNull();
      expect(parseBalanceInput("   ")).toBeNull();
    });
    it("parses CLP-formatted strings", () => {
      expect(parseBalanceInput("$1.000")).toBe(1000);
      expect(parseBalanceInput("CLP 2.500")).toBe(2500);
    });
    it("uses comma as decimal", () => {
      expect(parseBalanceInput("1,5")).toBe(1.5);
    });
    it("returns null for non-string", () => {
      expect(parseBalanceInput(42 as unknown as string)).toBeNull();
    });
    it("returns null for unparseable", () => {
      expect(parseBalanceInput("abc")).toBeNull();
    });
  });
});
