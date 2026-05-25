import { describe, expect, it } from "vitest";
import {
  isNonAccountableCategory,
  NON_ACCOUNTABLE_CATEGORY_ICON,
} from "./non-accountable-category";

describe("NON_ACCOUNTABLE_CATEGORY_ICON", () => {
  it("is the string NON_ACCOUNTABLE", () => {
    expect(NON_ACCOUNTABLE_CATEGORY_ICON).toBe("NON_ACCOUNTABLE");
  });
});

describe("isNonAccountableCategory", () => {
  it("returns false for null", () => {
    expect(isNonAccountableCategory(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isNonAccountableCategory(undefined)).toBe(false);
  });

  it("returns true when icon is NON_ACCOUNTABLE", () => {
    expect(isNonAccountableCategory({ icon: "NON_ACCOUNTABLE", name: "Whatever" })).toBe(true);
  });

  it("returns true when name exactly matches (case-insensitive)", () => {
    expect(isNonAccountableCategory({ name: "No contabilizable" })).toBe(true);
  });

  it("returns true when name matches with accents stripped", () => {
    expect(isNonAccountableCategory({ name: "No Contabilizable" })).toBe(true);
  });

  it("returns true when name has extra whitespace", () => {
    expect(isNonAccountableCategory({ name: "  no contabilizable  " })).toBe(true);
  });

  it("matches name with accented characters that normalize to the target string", () => {
    // NFD normalization strips accents: 'ó' → 'o', so "nó cóntabilizable" → "no contabilizable"
    expect(isNonAccountableCategory({ name: "nó cóntabilizable" })).toBe(true);
    // Standard no-accent version also matches
    expect(isNonAccountableCategory({ name: "No contabilizable" })).toBe(true);
  });

  it("returns false for an unrelated category name", () => {
    expect(isNonAccountableCategory({ name: "Gastos operacionales" })).toBe(false);
  });

  it("returns false when icon is null and name does not match", () => {
    expect(isNonAccountableCategory({ icon: null, name: "Consulta" })).toBe(false);
  });

  it("returns true by icon even when name does not match", () => {
    expect(isNonAccountableCategory({ icon: "NON_ACCOUNTABLE", name: "Otro nombre" })).toBe(true);
  });

  it("returns false for empty name and no matching icon", () => {
    expect(isNonAccountableCategory({ name: "" })).toBe(false);
  });

  it("returns false when icon is some other value", () => {
    expect(isNonAccountableCategory({ icon: "OTHER_ICON", name: "Consulta" })).toBe(false);
  });

  it("returns false when name is null/undefined (covers ?? '' branch line 4)", () => {
    // Category provided (not null) but name is null → triggers `?? ""` fallback in normalizer
    expect(isNonAccountableCategory({ icon: null, name: null as unknown as string })).toBe(false);
    expect(isNonAccountableCategory({ name: undefined as unknown as string })).toBe(false);
  });
});
