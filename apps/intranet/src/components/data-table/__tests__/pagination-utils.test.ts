import { describe, expect, it } from "vitest";

import {
  clampPageIndex,
  computePaginationView,
  normalizePageSizeOptions,
} from "../pagination-utils";

describe("computePaginationView", () => {
  it("first page of a 5-page table", () => {
    const view = computePaginationView({ computedTotalPages: 5, pageIndex: 0 });
    expect(view).toEqual({
      canNext: true,
      canPrevious: false,
      currentPageIndex: 0,
      currentPageNumber: 1,
      hasKnownTotalPages: true,
      totalPages: 5,
    });
  });

  it("last page disables next", () => {
    const view = computePaginationView({ computedTotalPages: 5, pageIndex: 4 });
    expect(view.canNext).toBe(false);
    expect(view.canPrevious).toBe(true);
    expect(view.currentPageNumber).toBe(5);
  });

  it("clamps total pages to at least 1", () => {
    const view = computePaginationView({ computedTotalPages: 0, pageIndex: 0 });
    expect(view.totalPages).toBe(1);
    expect(view.canNext).toBe(false);
    expect(view.canPrevious).toBe(false);
  });

  it("unknown total pages keeps next available", () => {
    const view = computePaginationView({ computedTotalPages: -1, pageIndex: 3 });
    expect(view.hasKnownTotalPages).toBe(false);
    expect(view.totalPages).toBe(4);
    expect(view.canNext).toBe(true);
  });

  it("normalizes negative pageIndex", () => {
    const view = computePaginationView({ computedTotalPages: 3, pageIndex: -2 });
    expect(view.currentPageIndex).toBe(0);
    expect(view.currentPageNumber).toBe(1);
  });
});

describe("normalizePageSizeOptions", () => {
  it("dedupes and sorts when current size already in options", () => {
    expect(normalizePageSizeOptions([10, 25, 50], 25)).toEqual([10, 25, 50]);
  });
  it("inserts current size when missing", () => {
    expect(normalizePageSizeOptions([10, 25, 50], 100)).toEqual([10, 25, 50, 100]);
  });
  it("handles empty options", () => {
    expect(normalizePageSizeOptions([], 20)).toEqual([20]);
  });
});

describe("clampPageIndex", () => {
  it("clamps to lower bound", () => {
    expect(clampPageIndex(-3, 5)).toBe(0);
  });
  it("clamps to upper bound", () => {
    expect(clampPageIndex(99, 5)).toBe(4);
  });
  it("returns 0 when totalPages is 0", () => {
    expect(clampPageIndex(2, 0)).toBe(0);
  });
  it("passes valid index through", () => {
    expect(clampPageIndex(2, 5)).toBe(2);
  });
});
