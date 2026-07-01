import { describe, expect, it, vi } from "vitest";

// `largestPackageDims` is a pure helper in orpc/checkout.ts (exported for this
// test). Importing checkout.ts pulls the whole checkout router graph, which
// imports `@finanzas/db` at module load — mock it (+ slices) so the import
// resolves without a real DB/ZenStack client. The fn itself touches no db.

const { mockDb } = vi.hoisted(() => {
  const mockDb = { $setOptions: () => mockDb };
  return { mockDb };
});
vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { largestPackageDims } = await import("./checkout.ts");

type P = { heightCm: number | null; widthCm: number | null; lengthCm: number | null };
const p = (h: number | null, w: number | null, l: number | null): P => ({
  heightCm: h,
  widthCm: w,
  lengthCm: l,
});

describe("largestPackageDims", () => {
  it("returns the 10×20×30 default for an empty product list", () => {
    expect(largestPackageDims([])).toEqual({ height: 10, width: 20, length: 30 });
  });

  it("returns the 10×20×30 default when a product has all-null dims", () => {
    expect(largestPackageDims([p(null, null, null)])).toEqual({
      height: 10,
      width: 20,
      length: 30,
    });
  });

  it("returns a single fully-dimensioned product's own dims", () => {
    expect(largestPackageDims([p(5, 6, 7)])).toEqual({ height: 5, width: 6, length: 7 });
  });

  it("picks the largest product BY VOLUME, not by any single dimension", () => {
    // A: 2×2×100 = 400. B: 5×5×5 = 125. C: 10×10×10 = 1000 (largest vol,
    // though A has a bigger single dimension). C must win.
    const best = largestPackageDims([p(2, 2, 100), p(5, 5, 5), p(10, 10, 10)]);
    expect(best).toEqual({ height: 10, width: 10, length: 10 });
  });

  it("keeps the incumbent when a later product has strictly smaller volume", () => {
    // first is bigger (1000) — second (125) must NOT replace it (`>` not `>=`).
    expect(largestPackageDims([p(10, 10, 10), p(5, 5, 5)])).toEqual({
      height: 10,
      width: 10,
      length: 10,
    });
  });

  it("defaults each null-dim product to 10×20×30 BEFORE comparing, so it can win", () => {
    // Real product volume 4×4×4 = 64. Null-dim product defaults to
    // 10×20×30 = 6000 → the DEFAULTED unknown product wins, never shrinking
    // the package below the baseline. Result is the full default box.
    expect(largestPackageDims([p(4, 4, 4), p(null, null, null)])).toEqual({
      height: 10,
      width: 20,
      length: 30,
    });
  });

  it("a smaller fully-dimensioned product can't shrink the package below the default", () => {
    // The tiny product (1×1×1=1) is compared against the null product defaulted
    // to 6000 → default box wins; the tiny dims are never returned.
    const best = largestPackageDims([p(null, null, null), p(1, 1, 1)]);
    expect(best).toEqual({ height: 10, width: 20, length: 30 });
    expect(best.height).not.toBe(1);
  });

  it("fills each missing axis independently from the default (partial dims)", () => {
    // height null → 10, width 50, length null → 30 → vol 10*50*30 = 15000.
    expect(largestPackageDims([p(null, 50, null)])).toEqual({
      height: 10,
      width: 50,
      length: 30,
    });
  });

  it("returns a fresh copy of the default (not a shared frozen ref)", () => {
    const a = largestPackageDims([]);
    a.height = 999;
    const b = largestPackageDims([]);
    expect(b.height).toBe(10);
  });
});
