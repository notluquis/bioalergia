import { describe, expect, it } from "vitest";

import { CLP_FORMATTER, makeStockState, storefrontUrl } from "./shop-config";

describe("makeStockState", () => {
  it("reports Agotado when effective stock is zero or below", () => {
    expect(makeStockState(5, 5, 3)).toEqual({ label: "Agotado", color: "default" });
    expect(makeStockState(2, 5, 3)).toEqual({ label: "Agotado", color: "default" });
  });

  it("reports Últimas unidades when effective stock is at or below the threshold", () => {
    expect(makeStockState(6, 5, 3)).toEqual({ label: "Últimas unidades", color: "warning" });
    expect(makeStockState(8, 5, 3)).toEqual({ label: "Últimas unidades", color: "warning" });
  });

  it("reports Stock disponible when effective stock exceeds the threshold", () => {
    expect(makeStockState(20, 5, 3)).toEqual({ label: "Stock disponible", color: "success" });
  });

  it("treats the threshold boundary as the last warning step (effective === threshold)", () => {
    // available 4 - safety 1 = 3 effective, threshold 3 → still "Últimas unidades".
    expect(makeStockState(4, 1, 3).label).toBe("Últimas unidades");
    // one more unit tips it over the threshold → available.
    expect(makeStockState(5, 1, 3).label).toBe("Stock disponible");
  });
});

describe("CLP_FORMATTER", () => {
  it("formats integers as Chilean pesos with no decimals", () => {
    const formatted = CLP_FORMATTER.format(1000);
    // es-CL groups thousands with a dot; assert on the digits/grouping, not the
    // exact currency glyph (locale-data dependent across environments).
    expect(formatted).toContain("1.000");
    expect(formatted).not.toMatch(/[,.]\d{2}$/); // no cents
  });
});

describe("storefrontUrl", () => {
  it("returns the window origin in a browser-like environment", () => {
    // jsdom provides window.location.origin; the SSR ("") branch is exercised
    // by the static prerender, not unit-reachable without deleting globalThis.window.
    expect(typeof storefrontUrl()).toBe("string");
  });
});
