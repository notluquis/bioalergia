import { describe, expect, it } from "vitest";

import { sortProducts } from "./catalog";

const rows = [
  { id: "a", price_clp: 300 },
  { id: "b", price_clp: 100 },
  { id: "c", price_clp: 200 },
];

describe("sortProducts", () => {
  it("sorts ascending by price for precio_asc (new array, input untouched)", () => {
    const out = sortProducts(rows, "precio_asc");
    expect(out.map((r) => r.price_clp)).toEqual([100, 200, 300]);
    // original order preserved (sorts a copy).
    expect(rows.map((r) => r.price_clp)).toEqual([300, 100, 200]);
    expect(out).not.toBe(rows);
  });

  it("sorts descending by price for precio_desc (new array, input untouched)", () => {
    const out = sortProducts(rows, "precio_desc");
    expect(out.map((r) => r.price_clp)).toEqual([300, 200, 100]);
    expect(rows.map((r) => r.price_clp)).toEqual([300, 100, 200]);
    expect(out).not.toBe(rows);
  });

  it("returns the SAME array reference unsorted for relevancia", () => {
    const out = sortProducts(rows, "relevancia");
    expect(out).toBe(rows);
  });

  it("returns the input as-is for any unknown key", () => {
    const out = sortProducts(rows, "weird");
    expect(out).toBe(rows);
  });

  it("handles an empty array for every branch", () => {
    expect(sortProducts([], "precio_asc")).toEqual([]);
    expect(sortProducts([], "precio_desc")).toEqual([]);
    expect(sortProducts([], "relevancia")).toEqual([]);
  });

  it("keeps equal prices stable in relative output", () => {
    const equal = [
      { id: "x", price_clp: 50 },
      { id: "y", price_clp: 50 },
    ];
    expect(sortProducts(equal, "precio_asc").map((r) => r.id)).toEqual(["x", "y"]);
    expect(sortProducts(equal, "precio_desc").map((r) => r.id)).toEqual(["x", "y"]);
  });
});
