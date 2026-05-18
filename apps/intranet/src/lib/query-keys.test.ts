/**
 * Tests for `queryKeys` — typed TanStack Query key factory.
 *
 * The factory contract:
 *   - Keys are stable arrays (referentially deterministic per input).
 *   - Equal-input calls produce structurally equal keys (deep equality, not
 *     identity), so TanStack Query's hash-based deduplication matches them.
 *   - Param-less factories normalise `undefined` to `{}` to keep cache keys
 *     consistent regardless of caller style.
 */
import { describe, expect, it } from "vitest";

import { queryKeys } from "./query-keys";

describe("queryKeys", () => {
  it("balances.report scopes under [balances, report, params]", () => {
    const k = queryKeys.balances.report({ from: "2026-01-01", to: "2026-01-31" });
    expect(k).toEqual(["balances", "report", { from: "2026-01-01", to: "2026-01-31" }]);
  });

  it("dashboard.recentMovements normalises missing params to {}", () => {
    expect(queryKeys.dashboard.recentMovements()).toEqual(["dashboard", "recentMovements", {}]);
    expect(queryKeys.dashboard.recentMovements({ page: 1 })).toEqual([
      "dashboard",
      "recentMovements",
      { page: 1 },
    ]);
  });

  it("inventory.items is parameterless and stable", () => {
    expect(queryKeys.inventory.items()).toEqual(["inventory", "items"]);
  });

  it("participants.leaderboard includes the full params object", () => {
    expect(queryKeys.participants.leaderboard({ from: "a", limit: 5, mode: "m", to: "b" })).toEqual(
      ["participants", "leaderboard", { from: "a", limit: 5, mode: "m", to: "b" }]
    );
  });

  it("transactions.movements carries nested filter shape", () => {
    const k = queryKeys.transactions.movements({
      filters: { direction: "in", from: "2026-01-01" },
      page: 2,
      pageSize: 25,
    });
    expect(k).toEqual([
      "transactions",
      "movements",
      { filters: { direction: "in", from: "2026-01-01" }, page: 2, pageSize: 25 },
    ]);
  });

  it("supplies.* return scoped two-segment keys", () => {
    expect(queryKeys.supplies.common()).toEqual(["supplies", "common"]);
    expect(queryKeys.supplies.requests()).toEqual(["supplies", "requests"]);
  });

  it("stats.overview namespaces under [stats, overview, params]", () => {
    expect(queryKeys.stats.overview({})).toEqual(["stats", "overview", {}]);
  });
});
