import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePagination } from "./usePagination";

describe("usePagination", () => {
  it("should initialize with default values", () => {
    const { result } = renderHook(() => usePagination());
    expect(result.current.pagination.page).toBe(1);
    expect(result.current.pagination.pageSize).toBe(25);
  });

  it("should initialize with custom values", () => {
    const { result } = renderHook(() => usePagination({ initialPage: 2, initialPageSize: 10 }));
    expect(result.current.pagination.page).toBe(2);
    expect(result.current.pagination.pageSize).toBe(10);
  });

  it("should go to next page", () => {
    const { result } = renderHook(() => usePagination());
    act(() => {
      result.current.nextPage();
    });
    expect(result.current.pagination.page).toBe(2);
  });

  it("should go to prev page", () => {
    const { result } = renderHook(() => usePagination({ initialPage: 2 }));
    act(() => {
      result.current.prevPage();
    });
    expect(result.current.pagination.page).toBe(1);
  });

  it("should not go below page 1", () => {
    const { result } = renderHook(() => usePagination({ initialPage: 1 }));
    act(() => {
      result.current.prevPage();
    });
    expect(result.current.pagination.page).toBe(1);
  });

  it("should set page directly", () => {
    const { result } = renderHook(() => usePagination());
    act(() => {
      result.current.setPage(5);
    });
    expect(result.current.pagination.page).toBe(5);
  });

  it("should reset to page 1 when changing page size", () => {
    const { result } = renderHook(() => usePagination({ initialPage: 5 }));
    act(() => {
      result.current.setPageSize(50);
    });
    expect(result.current.pagination.pageSize).toBe(50);
    expect(result.current.pagination.page).toBe(1);
  });

  it("should calculate page info correctly", () => {
    const { result } = renderHook(() => usePagination({ initialPage: 1, initialPageSize: 10 }));
    const info = result.current.getPageInfo(100);
    expect(info.start).toBe(1);
    expect(info.end).toBe(10);
    expect(info.totalPages).toBe(10);
    expect(info.total).toBe(100);
  });

  it("should calculate page info correctly for last page", () => {
    const { result } = renderHook(() => usePagination({ initialPage: 2, initialPageSize: 10 }));
    const info = result.current.getPageInfo(15);
    expect(info.start).toBe(11);
    expect(info.end).toBe(15);
    expect(info.totalPages).toBe(2);
  });

  it("should determine if can go next", () => {
    const { result } = renderHook(() => usePagination({ initialPage: 1, initialPageSize: 10 }));
    expect(result.current.canGoNext(15)).toBe(true);
    expect(result.current.canGoNext(10)).toBe(false);
  });

  it("should determine if can go prev", () => {
    const { result } = renderHook(() => usePagination({ initialPage: 2 }));
    expect(result.current.canGoPrev()).toBe(true);

    const { result: result2 } = renderHook(() => usePagination({ initialPage: 1 }));
    expect(result2.current.canGoPrev()).toBe(false);
  });
});
