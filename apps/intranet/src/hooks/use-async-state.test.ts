import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useAsyncState } from "./use-async-state";

describe("useAsyncState", () => {
  it("initializes with undefined data when no initial value given", () => {
    const { result } = renderHook(() => useAsyncState());
    expect(result.current.data).toBeUndefined();
  });

  it("initializes with provided initialData", () => {
    const { result } = renderHook(() => useAsyncState<number[]>([1, 2, 3]));
    expect(result.current.data).toEqual([1, 2, 3]);
  });

  it("initializes with loading=false", () => {
    const { result } = renderHook(() => useAsyncState());
    expect(result.current.loading).toBe(false);
  });

  it("initializes with error=null", () => {
    const { result } = renderHook(() => useAsyncState());
    expect(result.current.error).toBeNull();
  });

  it("setData updates data", () => {
    const { result } = renderHook(() => useAsyncState<string>());
    act(() => {
      result.current.setData("hello");
    });
    expect(result.current.data).toBe("hello");
  });

  it("setLoading updates loading state to true", () => {
    const { result } = renderHook(() => useAsyncState());
    act(() => {
      result.current.setLoading(true);
    });
    expect(result.current.loading).toBe(true);
  });

  it("setLoading can reset loading to false", () => {
    const { result } = renderHook(() => useAsyncState());
    act(() => {
      result.current.setLoading(true);
    });
    act(() => {
      result.current.setLoading(false);
    });
    expect(result.current.loading).toBe(false);
  });

  it("setError updates error string", () => {
    const { result } = renderHook(() => useAsyncState());
    act(() => {
      result.current.setError("algo salió mal");
    });
    expect(result.current.error).toBe("algo salió mal");
  });

  it("clearError resets error to null", () => {
    const { result } = renderHook(() => useAsyncState());
    act(() => {
      result.current.setError("error previo");
    });
    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });

  it("reset restores initial state", () => {
    const initial = { name: "test" };
    const { result } = renderHook(() => useAsyncState(initial));
    act(() => {
      result.current.setData({ name: "changed" });
      result.current.setLoading(true);
      result.current.setError("oops");
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.data).toEqual(initial);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("reset with no initial data sets data back to undefined", () => {
    const { result } = renderHook(() => useAsyncState<string>());
    act(() => {
      result.current.setData("something");
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.data).toBeUndefined();
  });

  it("exposes all required fields and functions", () => {
    const { result } = renderHook(() => useAsyncState());
    expect(typeof result.current.setData).toBe("function");
    expect(typeof result.current.setLoading).toBe("function");
    expect(typeof result.current.setError).toBe("function");
    expect(typeof result.current.clearError).toBe("function");
    expect(typeof result.current.reset).toBe("function");
  });
});
