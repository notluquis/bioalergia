/**
 * Tests for `@/features/dashboard/api` — the stats + recent-movements
 * server fetchers used by the home dashboard.
 *
 * - `fetchStats` runs the response through the shared
 *   `transactionsInsightsStatsResponseSchema` from the orpc-contracts
 *   package; malformed payloads bubble up as ApiError.
 * - `fetchRecentMovements` parses the oRPC contract payload and maps the
 *   `amount` / `date` / `type` fields onto the legacy `transactionAmount` /
 *   `transactionDate` / `transactionType` shape the widget consumes (a blind
 *   cast left every row rendering as $0).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

const financeOrpc = vi.hoisted(() => ({
  transactionsList: vi.fn(),
}));

const insightsOrpc = vi.hoisted(() => ({
  stats: vi.fn(),
}));

vi.mock("@/features/finance/orpc", () => ({
  financeORPCClient: financeOrpc,
}));

vi.mock("@/features/finance/transactions-insights-orpc", () => ({
  transactionsInsightsORPCClient: insightsOrpc,
  toTransactionsInsightsApiError: (e: unknown) => {
    if (e instanceof ApiError) return e;
    if (e instanceof Error) return new ApiError(e.message, 500);
    return new ApiError("unexpected", 500, e);
  },
}));

const { fetchRecentMovements, fetchStats } = await import("./api");

describe("dashboard/api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchRecentMovements", () => {
    it("requests page 1 with pageSize=5", async () => {
      financeOrpc.transactionsList.mockResolvedValue({ data: [], status: "ok" });
      await fetchRecentMovements();
      expect(financeOrpc.transactionsList).toHaveBeenCalledWith({ page: 1, pageSize: 5 });
    });

    it("maps contract `amount`/`date`/`type` onto the widget shape", async () => {
      const incomeDate = new Date("2026-06-14T00:20:00.000Z");
      const expenseDate = new Date("2026-06-13T12:00:00.000Z");
      financeOrpc.transactionsList.mockResolvedValue({
        status: "ok",
        data: [
          {
            id: 1,
            amount: 1000,
            categoryId: null,
            counterpart: null,
            date: incomeDate,
            description: "Pago consulta",
            sourceId: "src-1",
            type: "INCOME",
          },
          {
            id: 2,
            amount: 500, // unsigned in payload — must be negated for EXPENSE
            categoryId: null,
            counterpart: null,
            date: expenseDate,
            description: "Arriendo",
            sourceId: "src-2",
            type: "EXPENSE",
          },
        ],
      });

      const result = await fetchRecentMovements();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 1,
        description: "Pago consulta",
        sourceId: "src-1",
        transactionAmount: 1000,
        transactionDate: incomeDate,
        transactionType: "Ingreso",
      });
      expect(result[1]).toMatchObject({
        id: 2,
        description: "Arriendo",
        transactionAmount: -500,
        transactionDate: expenseDate,
        transactionType: "Egreso",
      });
    });
  });

  describe("fetchStats", () => {
    const sample = {
      status: "ok" as const,
      byType: [{ description: "Sueldos", direction: "OUT" as const, total: -500_000 }],
      monthly: [{ in: 1_000_000, month: "2026-01", net: 500_000, out: -500_000 }],
      totals: { in: 1_000_000, out: -500_000, net: 500_000 },
    };

    it("returns the parsed stats response on a well-formed payload", async () => {
      insightsOrpc.stats.mockResolvedValue(sample);
      const result = await fetchStats("2026-01-01", "2026-01-31");
      expect(result.totals.net).toBe(500_000);
      expect(insightsOrpc.stats).toHaveBeenCalledWith({
        from: "2026-01-01",
        granularity: "day",
        to: "2026-01-31",
      });
    });

    it("throws ApiError when the contract schema rejects the payload", async () => {
      insightsOrpc.stats.mockResolvedValue({
        byType: "not-an-array",
        monthly: [],
        totals: {},
      });
      await expect(fetchStats("2026-01-01", "2026-01-31")).rejects.toBeInstanceOf(ApiError);
    });

    it("wraps oRPC client failures via toTransactionsInsightsApiError", async () => {
      insightsOrpc.stats.mockRejectedValue(new Error("upstream 503"));
      await expect(fetchStats("a", "b")).rejects.toMatchObject({
        name: "ApiError",
        message: "upstream 503",
      });
    });
  });
});
