import { describe, expect, it } from "vitest";

import { hasCompareAtSaving, maxAddableQty } from "./product-detail";

describe("maxAddableQty", () => {
  it("returns sellable stock when within 1..99", () => {
    expect(maxAddableQty(40, 5)).toBe(35);
  });

  it("clamps to 99 when sellable stock is huge", () => {
    expect(maxAddableQty(500, 10)).toBe(99);
  });

  it("clamps to a floor of 1 when sellable stock is zero", () => {
    expect(maxAddableQty(5, 5)).toBe(1);
  });

  it("clamps to a floor of 1 when sellable stock is negative", () => {
    expect(maxAddableQty(2, 5)).toBe(1);
  });

  it("returns exactly 99 at the upper boundary", () => {
    expect(maxAddableQty(99, 0)).toBe(99);
  });
});

describe("hasCompareAtSaving", () => {
  it("is true when compare-at price is strictly greater than price", () => {
    expect(hasCompareAtSaving(24_990, 34_990)).toBe(true);
  });

  it("is false when compare-at equals price (no saving)", () => {
    expect(hasCompareAtSaving(24_990, 24_990)).toBe(false);
  });

  it("is false when compare-at is lower than price", () => {
    expect(hasCompareAtSaving(24_990, 19_990)).toBe(false);
  });

  it("is false when compare-at is null", () => {
    expect(hasCompareAtSaving(24_990, null)).toBe(false);
  });

  it("is false when compare-at is undefined", () => {
    expect(hasCompareAtSaving(24_990, undefined)).toBe(false);
  });

  it("is false when compare-at is 0 (no saving, not greater)", () => {
    expect(hasCompareAtSaving(24_990, 0)).toBe(false);
  });
});
