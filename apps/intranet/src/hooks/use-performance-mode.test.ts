/**
 * Tests for `usePerformanceMode` — heuristic device classifier (hook variant).
 */
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePerformanceMode } from "./use-performance-mode";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockNav({
  cores,
  memory,
  saveData,
  effectiveType,
}: {
  cores?: number;
  memory?: number;
  saveData?: boolean;
  effectiveType?: string;
}) {
  if (cores !== undefined) {
    vi.spyOn(navigator, "hardwareConcurrency", "get").mockReturnValue(cores);
  }
  if (memory !== undefined) {
    Object.defineProperty(navigator, "deviceMemory", {
      configurable: true,
      get: () => memory,
    });
  }
  if (saveData !== undefined || effectiveType !== undefined) {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      get: () => ({ saveData: saveData ?? false, effectiveType }),
    });
  }
}

describe("usePerformanceMode", () => {
  it('returns high mode + reason "Hardware potente" on capable devices', () => {
    mockNav({ cores: 16, memory: 16, saveData: false, effectiveType: "4g" });
    const { result } = renderHook(() => usePerformanceMode());
    expect(result.current.mode).toBe("high");
    expect(result.current.reason).toBe("Hardware potente");
    expect(result.current.score).toBe(100);
  });

  it("flags reason when CPU cores <= 4 (combined penalties push to low)", () => {
    // Single penalty (-30) doesn't tip a 100-baseline below the 70
    // `>= 70 high` threshold; combined with another penalty it does.
    mockNav({ cores: 4, memory: 2, saveData: false, effectiveType: "4g" });
    const { result } = renderHook(() => usePerformanceMode());
    expect(result.current.mode).toBe("low");
    expect(result.current.reason).toMatch(/núcleos/);
  });

  it("subtracts 30 points for low RAM", () => {
    mockNav({ cores: 16, memory: 2, saveData: false, effectiveType: "4g" });
    const { result } = renderHook(() => usePerformanceMode());
    expect(result.current.score).toBeLessThanOrEqual(70);
    expect(result.current.reason).toMatch(/RAM/);
  });

  it("flags low mode when saveData is enabled and connection is 2g", () => {
    mockNav({ cores: 16, memory: 16, saveData: true, effectiveType: "2g" });
    const { result } = renderHook(() => usePerformanceMode());
    // 100 - 20 (saveData) - 20 (2g) = 60 → low
    expect(result.current.mode).toBe("low");
    expect(result.current.reason).toContain("Modo ahorro datos");
    expect(result.current.reason).toContain("Conexión lenta");
  });

  it("score crossing 70 is the high/low boundary", () => {
    mockNav({ cores: 8, memory: 8, saveData: false, effectiveType: "4g" });
    const { result } = renderHook(() => usePerformanceMode());
    expect(result.current.mode).toBe("high");
  });
});
