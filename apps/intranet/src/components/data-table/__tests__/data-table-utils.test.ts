import { describe, expect, it } from "vitest";

import {
  applyVisibleSelection,
  buildExportFilename,
  descriptorToSortingState,
  getColumnLabel,
  getStableRowId,
  isUtilityColumnId,
  resolveScrollMode,
  rowSelectionToKeys,
  shouldEnableInternalScroll,
  shouldVirtualizeRows,
  sortingStateToDescriptor,
} from "../data-table-utils";

describe("getStableRowId", () => {
  it("prefers `id` field", () => {
    expect(getStableRowId({ id: 42, employeeId: 7 }, 0)).toBe("42");
  });
  it("falls back to `employeeId` when id missing", () => {
    expect(getStableRowId({ employeeId: 7 }, 0)).toBe("7");
  });
  it("falls back to `_id`", () => {
    expect(getStableRowId({ _id: "abc" }, 0)).toBe("abc");
  });
  it("falls back to row_<index> when nothing present", () => {
    expect(getStableRowId({}, 3)).toBe("row_3");
  });
  it("treats empty-string id as missing", () => {
    expect(getStableRowId({ id: "" }, 9)).toBe("row_9");
  });
  it("survives null input", () => {
    expect(getStableRowId(null, 1)).toBe("row_1");
  });
});

describe("sortingStateToDescriptor", () => {
  it("returns undefined for empty sort", () => {
    expect(sortingStateToDescriptor([])).toBeUndefined();
  });
  it("maps ascending sort", () => {
    expect(sortingStateToDescriptor([{ id: "name", desc: false }])).toEqual({
      column: "name",
      direction: "ascending",
    });
  });
  it("maps descending sort", () => {
    expect(sortingStateToDescriptor([{ id: "age", desc: true }])).toEqual({
      column: "age",
      direction: "descending",
    });
  });
});

describe("descriptorToSortingState", () => {
  it("returns empty when descriptor is null", () => {
    expect(descriptorToSortingState(null)).toEqual([]);
  });
  it("returns empty when no column", () => {
    expect(descriptorToSortingState({ column: undefined } as never)).toEqual([]);
  });
  it("maps ascending to desc:false", () => {
    expect(descriptorToSortingState({ column: "name", direction: "ascending" })).toEqual([
      { id: "name", desc: false },
    ]);
  });
  it("maps descending to desc:true", () => {
    expect(descriptorToSortingState({ column: "name", direction: "descending" })).toEqual([
      { id: "name", desc: true },
    ]);
  });
});

describe("rowSelectionToKeys", () => {
  it("returns only truthy rows", () => {
    const set = rowSelectionToKeys({ a: true, b: false, c: true });
    expect(set).toEqual(new Set(["a", "c"]));
  });
  it("handles empty input", () => {
    expect(rowSelectionToKeys({})).toEqual(new Set());
  });
});

describe("applyVisibleSelection", () => {
  it("selects all visible rows on 'all'", () => {
    const out = applyVisibleSelection({}, ["a", "b"], "all");
    expect(out).toEqual({ a: true, b: true });
  });
  it("preserves selection of rows outside the visible window", () => {
    const out = applyVisibleSelection({ x: true, a: true }, ["a", "b"], new Set(["b"]));
    expect(out).toEqual({ x: true, b: true });
  });
  it("clears all visible rows on empty selection", () => {
    const out = applyVisibleSelection({ a: true, b: true }, ["a", "b"], new Set());
    expect(out).toEqual({});
  });
});

describe("resolveScrollMode", () => {
  it("promotes auto to container when pagination disabled", () => {
    expect(resolveScrollMode("auto", false)).toBe("container");
  });
  it("keeps auto when pagination enabled", () => {
    expect(resolveScrollMode("auto", true)).toBe("auto");
  });
  it("passes through container/page modes", () => {
    expect(resolveScrollMode("container", true)).toBe("container");
    expect(resolveScrollMode("page", false)).toBe("page");
  });
});

describe("shouldEnableInternalScroll", () => {
  const base = {
    enableVirtualization: false,
    hasPagination: true,
    scrollMaxHeight: undefined,
    scrollMode: "auto" as const,
  };
  it("returns true for container mode regardless of other inputs", () => {
    expect(shouldEnableInternalScroll({ ...base, scrollMode: "container" })).toBe(true);
  });
  it("returns false for page mode", () => {
    expect(
      shouldEnableInternalScroll({ ...base, scrollMode: "page", enableVirtualization: true })
    ).toBe(false);
  });
  it("auto: true when scrollMaxHeight provided", () => {
    expect(shouldEnableInternalScroll({ ...base, scrollMaxHeight: "300px" })).toBe(true);
  });
  it("auto: true when virtualization enabled", () => {
    expect(shouldEnableInternalScroll({ ...base, enableVirtualization: true })).toBe(true);
  });
  it("auto: true when no pagination", () => {
    expect(shouldEnableInternalScroll({ ...base, hasPagination: false })).toBe(true);
  });
  it("auto: false default case", () => {
    expect(shouldEnableInternalScroll(base)).toBe(false);
  });
});

describe("shouldVirtualizeRows", () => {
  const base = {
    enableVirtualization: true,
    hasRenderSubComponent: false,
    rowCount: 100,
    threshold: 80,
  };
  it("activates above threshold", () => {
    expect(shouldVirtualizeRows(base)).toBe(true);
  });
  it("respects threshold floor", () => {
    expect(shouldVirtualizeRows({ ...base, rowCount: 79 })).toBe(false);
  });
  it("disabled when virtualization off", () => {
    expect(shouldVirtualizeRows({ ...base, enableVirtualization: false })).toBe(false);
  });
  it("disabled when sub-row component is in use", () => {
    expect(shouldVirtualizeRows({ ...base, hasRenderSubComponent: true })).toBe(false);
  });
});

describe("isUtilityColumnId", () => {
  it("matches actions and select", () => {
    expect(isUtilityColumnId("actions")).toBe(true);
    expect(isUtilityColumnId("select")).toBe(true);
  });
  it("rejects everything else", () => {
    expect(isUtilityColumnId("name")).toBe(false);
    expect(isUtilityColumnId("")).toBe(false);
  });
});

describe("getColumnLabel", () => {
  it("returns string headers verbatim", () => {
    expect(getColumnLabel("Nombre", "name")).toBe("Nombre");
  });
  it("falls back to id when header is non-string", () => {
    expect(getColumnLabel(() => "el", "name")).toBe("name");
    expect(getColumnLabel(undefined, "name")).toBe("name");
  });
});

describe("buildExportFilename", () => {
  it("emits ISO yyyy-mm-dd format", () => {
    expect(buildExportFilename(new Date("2026-05-13T00:00:00Z"))).toBe("export-2026-05-13.csv");
  });
  it("defaults to today when no date passed", () => {
    expect(buildExportFilename()).toMatch(/^export-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
