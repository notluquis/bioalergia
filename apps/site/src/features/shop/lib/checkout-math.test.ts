import { describe, expect, it } from "vitest";

import { computeOrderTotal, pickCheapestShippingOption } from "./checkout-math";

describe("computeOrderTotal", () => {
  it("adds shipping to the cart total", () => {
    expect(computeOrderTotal(50_970, 3_990)).toBe(54_960);
  });

  it("returns the cart total unchanged when shipping is free (0)", () => {
    expect(computeOrderTotal(50_970, 0)).toBe(50_970);
  });

  it("returns just shipping when the cart total is 0 (missing cart sentinel)", () => {
    expect(computeOrderTotal(0, 3_990)).toBe(3_990);
  });

  it("returns 0 when both are 0", () => {
    expect(computeOrderTotal(0, 0)).toBe(0);
  });
});

describe("pickCheapestShippingOption", () => {
  it("returns the option with the lowest shipping_clp", () => {
    const cheapest = pickCheapestShippingOption([
      { service_code: "EXPRESS", shipping_clp: 3_990 },
      { service_code: "STANDARD", shipping_clp: 2_490 },
    ]);
    expect(cheapest?.service_code).toBe("STANDARD");
  });

  it("does not mutate the input order", () => {
    const options = [
      { service_code: "EXPRESS", shipping_clp: 3_990 },
      { service_code: "STANDARD", shipping_clp: 2_490 },
    ];
    pickCheapestShippingOption(options);
    expect(options.map((o) => o.service_code)).toEqual(["EXPRESS", "STANDARD"]);
  });

  it("returns undefined for an empty list", () => {
    expect(pickCheapestShippingOption([])).toBeUndefined();
  });

  it("returns the only option for a single-element list", () => {
    const only = pickCheapestShippingOption([{ service_code: "ONLY", shipping_clp: 1_000 }]);
    expect(only?.service_code).toBe("ONLY");
  });

  it("returns the first of ties (stable for equal prices)", () => {
    const cheapest = pickCheapestShippingOption([
      { service_code: "A", shipping_clp: 1_000 },
      { service_code: "B", shipping_clp: 1_000 },
    ]);
    expect(cheapest?.service_code).toBe("A");
  });
});
