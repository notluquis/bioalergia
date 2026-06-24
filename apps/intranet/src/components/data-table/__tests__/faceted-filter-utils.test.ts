import { describe, expect, it } from "vitest";

import {
  filterOptionsBySearch,
  matchesColumnSearch,
  resolveFacetedFilterValue,
} from "../faceted-filter-utils";

const options = [
  { label: "Activos", value: "active" },
  { label: "Inactivos", value: "inactive" },
  { label: "Pendientes", value: "pending" },
];

describe("filterOptionsBySearch", () => {
  it("matches case-insensitively on label", () => {
    expect(filterOptionsBySearch(options, "ACT")).toEqual([
      { label: "Activos", value: "active" },
      { label: "Inactivos", value: "inactive" },
    ]);
  });
  it("returns all on empty search", () => {
    expect(filterOptionsBySearch(options, "")).toHaveLength(3);
  });
  it("returns empty when no match", () => {
    expect(filterOptionsBySearch(options, "zz")).toEqual([]);
  });
});

describe("resolveFacetedFilterValue", () => {
  it("returns undefined when 'clear' key is in selection", () => {
    expect(resolveFacetedFilterValue(options, new Set(["clear"]))).toBeUndefined();
  });
  it("returns undefined when selection empty", () => {
    expect(resolveFacetedFilterValue(options, new Set())).toBeUndefined();
  });
  it("returns array of selected values", () => {
    const out = resolveFacetedFilterValue(options, new Set(["active", "pending"]));
    expect(out).toEqual(expect.arrayContaining(["active", "pending"]));
    expect(out).toHaveLength(2);
  });
  it("expands 'all' to every option value", () => {
    const out = resolveFacetedFilterValue(options, "all");
    expect(out).toEqual(expect.arrayContaining(["active", "inactive", "pending"]));
    expect(out).toHaveLength(3);
  });
});

describe("matchesColumnSearch", () => {
  it("matches by header", () => {
    expect(matchesColumnSearch("Nombre completo", "fullName", "nombre")).toBe(true);
  });
  it("matches by id when header doesn't match", () => {
    expect(matchesColumnSearch("X", "fullName", "full")).toBe(true);
  });
  it("returns false when neither matches", () => {
    expect(matchesColumnSearch("X", "fullName", "zzz")).toBe(false);
  });
  it("matches everything on empty search", () => {
    expect(matchesColumnSearch("X", "y", "")).toBe(true);
  });
});
