import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useColumnVisibility } from "./use-column-visibility";

describe("useColumnVisibility", () => {
  it("initializes empty visibleColumns when no initialColumns provided", () => {
    const { result } = renderHook(() => useColumnVisibility());
    expect(result.current.visibleColumns).toEqual({});
  });

  it("initializes columns as visible by default", () => {
    const { result } = renderHook(() =>
      useColumnVisibility({ initialColumns: ["name", "age", "email"] })
    );
    expect(result.current.visibleColumns).toEqual({ name: true, age: true, email: true });
  });

  it("initializes columns as hidden when defaultVisible is false", () => {
    const { result } = renderHook(() =>
      useColumnVisibility({ initialColumns: ["name", "age"], defaultVisible: false })
    );
    expect(result.current.visibleColumns).toEqual({ name: false, age: false });
  });

  it("toggleColumn flips a visible column to hidden", () => {
    const { result } = renderHook(() =>
      useColumnVisibility({ initialColumns: ["name"], defaultVisible: true })
    );
    act(() => {
      result.current.toggleColumn("name");
    });
    expect(result.current.visibleColumns.name).toBe(false);
  });

  it("toggleColumn flips a hidden column to visible", () => {
    const { result } = renderHook(() =>
      useColumnVisibility({ initialColumns: ["name"], defaultVisible: false })
    );
    act(() => {
      result.current.toggleColumn("name");
    });
    expect(result.current.visibleColumns.name).toBe(true);
  });

  it("showColumn makes a column visible", () => {
    const { result } = renderHook(() =>
      useColumnVisibility({ initialColumns: ["col"], defaultVisible: false })
    );
    act(() => {
      result.current.showColumn("col");
    });
    expect(result.current.visibleColumns.col).toBe(true);
  });

  it("hideColumn makes a column hidden", () => {
    const { result } = renderHook(() =>
      useColumnVisibility({ initialColumns: ["col"], defaultVisible: true })
    );
    act(() => {
      result.current.hideColumn("col");
    });
    expect(result.current.visibleColumns.col).toBe(false);
  });

  it("showAllColumns sets all columns to visible", () => {
    const { result } = renderHook(() =>
      useColumnVisibility({ initialColumns: ["a", "b", "c"], defaultVisible: false })
    );
    act(() => {
      result.current.showAllColumns();
    });
    expect(result.current.visibleColumns).toEqual({ a: true, b: true, c: true });
  });

  it("hideAllColumns sets all columns to hidden", () => {
    const { result } = renderHook(() =>
      useColumnVisibility({ initialColumns: ["a", "b", "c"], defaultVisible: true })
    );
    act(() => {
      result.current.hideAllColumns();
    });
    expect(result.current.visibleColumns).toEqual({ a: false, b: false, c: false });
  });

  it("isColumnVisible returns true for visible column", () => {
    const { result } = renderHook(() =>
      useColumnVisibility({ initialColumns: ["x"], defaultVisible: true })
    );
    expect(result.current.isColumnVisible("x")).toBe(true);
  });

  it("isColumnVisible returns false for hidden column", () => {
    const { result } = renderHook(() =>
      useColumnVisibility({ initialColumns: ["x"], defaultVisible: false })
    );
    expect(result.current.isColumnVisible("x")).toBe(false);
  });

  it("isColumnVisible returns true for unknown columns (fallback)", () => {
    const { result } = renderHook(() => useColumnVisibility());
    // unknown column defaults to true
    expect(result.current.isColumnVisible("unknown")).toBe(true);
  });

  it("getVisibleColumns filters to only visible columns", () => {
    const { result } = renderHook(() =>
      useColumnVisibility({ initialColumns: ["a", "b", "c"], defaultVisible: true })
    );
    act(() => {
      result.current.hideColumn("b");
    });
    expect(result.current.getVisibleColumns(["a", "b", "c"])).toEqual(["a", "c"]);
  });

  it("toggleColumn on a column not in initialColumns adds it", () => {
    const { result } = renderHook(() => useColumnVisibility({ initialColumns: [] }));
    act(() => {
      result.current.toggleColumn("new");
    });
    // undefined => !undefined === true
    expect(result.current.visibleColumns.new).toBe(true);
  });
});
