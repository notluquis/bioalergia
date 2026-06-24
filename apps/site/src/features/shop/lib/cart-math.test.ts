import { describe, expect, it } from "vitest";

import { cartItemCount, lineTotalClp } from "./cart-math";

describe("lineTotalClp", () => {
  it("multiplies unit price by quantity", () => {
    expect(lineTotalClp(12_990, 2)).toBe(25_980);
  });

  it("returns 0 when quantity is zero", () => {
    expect(lineTotalClp(12_990, 0)).toBe(0);
  });

  it("returns 0 when the unit price is zero", () => {
    expect(lineTotalClp(0, 5)).toBe(0);
  });

  it("returns the unit price for a quantity of one", () => {
    expect(lineTotalClp(4_490, 1)).toBe(4_490);
  });
});

describe("cartItemCount", () => {
  it("sums quantities across all lines", () => {
    expect(
      cartItemCount([
        { unit_price_clp: 1, qty: 2 },
        { unit_price_clp: 1, qty: 1 },
        { unit_price_clp: 1, qty: 3 },
      ])
    ).toBe(6);
  });

  it("returns 0 for an empty cart", () => {
    expect(cartItemCount([])).toBe(0);
  });

  it("returns the single line quantity for a one-line cart", () => {
    expect(cartItemCount([{ unit_price_clp: 999, qty: 4 }])).toBe(4);
  });

  it("treats zero-quantity lines as contributing nothing", () => {
    expect(
      cartItemCount([
        { unit_price_clp: 10, qty: 0 },
        { unit_price_clp: 10, qty: 5 },
      ])
    ).toBe(5);
  });
});
