import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useLazyTabs } from "./use-lazy-tabs";

describe("useLazyTabs", () => {
  it("mounts the initial tab on creation", () => {
    const { result } = renderHook(() => useLazyTabs<string>("overview"));
    expect(result.current.isTabMounted("overview")).toBe(true);
  });

  it("does not mount other tabs initially", () => {
    const { result } = renderHook(() => useLazyTabs<string>("overview"));
    expect(result.current.isTabMounted("details")).toBe(false);
    expect(result.current.isTabMounted("settings")).toBe(false);
  });

  it("markTabAsMounted mounts a new tab", () => {
    const { result } = renderHook(() => useLazyTabs<string>("overview"));
    act(() => {
      result.current.markTabAsMounted("details");
    });
    expect(result.current.isTabMounted("details")).toBe(true);
  });

  it("markTabAsMounted is idempotent (no duplicate tabs)", () => {
    const { result } = renderHook(() => useLazyTabs<string>("overview"));
    act(() => {
      result.current.markTabAsMounted("details");
      result.current.markTabAsMounted("details");
    });
    // Internal Set deduplification — still mounted
    expect(result.current.isTabMounted("details")).toBe(true);
  });

  it("initial tab stays mounted after marking another tab", () => {
    const { result } = renderHook(() => useLazyTabs<string>("overview"));
    act(() => {
      result.current.markTabAsMounted("settings");
    });
    expect(result.current.isTabMounted("overview")).toBe(true);
  });

  it("multiple tabs can be mounted independently", () => {
    const { result } = renderHook(() => useLazyTabs<string>("tab1"));
    act(() => {
      result.current.markTabAsMounted("tab2");
      result.current.markTabAsMounted("tab3");
    });
    expect(result.current.isTabMounted("tab1")).toBe(true);
    expect(result.current.isTabMounted("tab2")).toBe(true);
    expect(result.current.isTabMounted("tab3")).toBe(true);
  });

  it("isTabMounted returns false for never-mounted tabs", () => {
    const { result } = renderHook(() => useLazyTabs<string>("a"));
    expect(result.current.isTabMounted("b")).toBe(false);
  });

  it("works with union type tabs", () => {
    type Tab = "overview" | "patients" | "history";
    const { result } = renderHook(() => useLazyTabs<Tab>("overview"));
    expect(result.current.isTabMounted("overview")).toBe(true);
    act(() => {
      result.current.markTabAsMounted("patients");
    });
    expect(result.current.isTabMounted("patients")).toBe(true);
    expect(result.current.isTabMounted("history")).toBe(false);
  });

  it("exposes stable function references (useCallback)", () => {
    const { result, rerender } = renderHook(() => useLazyTabs<string>("tab1"));
    const initialMarkFn = result.current.markTabAsMounted;
    const initialIsFn = result.current.isTabMounted;
    rerender();
    // markTabAsMounted has no deps, always same ref
    expect(result.current.markTabAsMounted).toBe(initialMarkFn);
    // isTabMounted depends on mountedTabs — same state so same ref
    expect(result.current.isTabMounted).toBe(initialIsFn);
  });
});
