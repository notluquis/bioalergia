import { describe, expect, it } from "vitest";
import { buildPaginationItems } from "../pagination-items";

describe("buildPaginationItems", () => {
  it("shows all pages when totalPages <= 7", () => {
    const items = buildPaginationItems({ currentPage: 1, totalPages: 5 });
    expect(items).toHaveLength(5);
    expect(items.every((i) => i.type === "page")).toBe(true);
    expect(items.map((i) => i.value)).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns single page for totalPages = 1", () => {
    const items = buildPaginationItems({ currentPage: 1, totalPages: 1 });
    expect(items).toHaveLength(1);
    expect(items[0]?.value).toBe(1);
  });

  it("clamps currentPage to valid range", () => {
    const items = buildPaginationItems({ currentPage: -5, totalPages: 3 });
    expect(items[0]?.value).toBe(1);
  });

  it("uses ellipsis for large page counts at start", () => {
    const items = buildPaginationItems({ currentPage: 1, totalPages: 10 });
    const types = items.map((i) => i.type);
    expect(types.includes("ellipsis")).toBe(true);
    expect(items[0]?.value).toBe(1);
    expect(items[items.length - 1]?.value).toBe(10);
  });

  it("shows ellipsis on both sides when in middle", () => {
    const items = buildPaginationItems({ currentPage: 6, totalPages: 12 });
    const types = items.map((i) => i.type);
    const ellipsisCount = types.filter((t) => t === "ellipsis").length;
    expect(ellipsisCount).toBe(2);
    expect(items[0]?.value).toBe(1);
    expect(items[items.length - 1]?.value).toBe(12);
  });

  it("no leading ellipsis when currentPage is near start", () => {
    const items = buildPaginationItems({ currentPage: 2, totalPages: 10 });
    expect(items[1]?.type).not.toBe("ellipsis");
  });

  it("no trailing ellipsis when currentPage is near end", () => {
    const items = buildPaginationItems({ currentPage: 9, totalPages: 10 });
    const lastEllipsisIdx = items.map((i) => i.type).lastIndexOf("ellipsis");
    const lastPageIdx = items.findIndex((i) => i.value === 10);
    expect(lastEllipsisIdx).toBeLessThan(lastPageIdx - 1);
  });

  it("keys are unique", () => {
    const items = buildPaginationItems({ currentPage: 5, totalPages: 12 });
    const keys = items.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
