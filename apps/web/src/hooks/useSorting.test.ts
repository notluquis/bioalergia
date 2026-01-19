import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSorting } from "./use-sorting";

describe("use-sorting", () => {
  it("should initialize with default values", () => {
    const { result } = renderHook(() => useSorting());
    expect(result.current.sortState.column).toBeNull();
    expect(result.current.sortState.direction).toBe("asc");
  });

  it("should initialize with custom values", () => {
    const { result } = renderHook(() => useSorting({ initialColumn: "name", initialDirection: "desc" }));
    expect(result.current.sortState.column).toBe("name");
    expect(result.current.sortState.direction).toBe("desc");
  });

  it("should sort by a column (asc default)", () => {
    const { result } = renderHook(() => useSorting());
    act(() => {
      result.current.sort("name");
    });
    expect(result.current.sortState.column).toBe("name");
    expect(result.current.sortState.direction).toBe("asc");
  });

  it("should toggle direction if sorting by same column", () => {
    const { result } = renderHook(() => useSorting({ initialColumn: "name", initialDirection: "asc" }));
    act(() => {
      result.current.sort("name");
    });
    expect(result.current.sortState.column).toBe("name");
    expect(result.current.sortState.direction).toBe("desc");
  });

  it("should clear sort if toggling from desc", () => {
    const { result } = renderHook(() => useSorting({ initialColumn: "name", initialDirection: "desc" }));
    act(() => {
      result.current.sort("name");
    });
    expect(result.current.sortState.column).toBeNull();
    expect(result.current.sortState.direction).toBe("asc"); // Reset to default
  });

  it("should switch column and reset to asc", () => {
    const { result } = renderHook(() => useSorting<string>({ initialColumn: "name", initialDirection: "desc" }));
    act(() => {
      result.current.sort("age");
    });
    expect(result.current.sortState.column).toBe("age");
    expect(result.current.sortState.direction).toBe("asc");
  });
});
