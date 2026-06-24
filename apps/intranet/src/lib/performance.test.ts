/**
 * Tests for `initPerformanceMonitoring` — heuristic device classifier that
 * toggles `perf-low` / `perf-high` classes on <html>.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initPerformanceMonitoring } from "./performance";

describe("initPerformanceMonitoring", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("perf-low", "perf-high");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("classifies as perf-high when CPU + RAM are healthy and no saveData", () => {
    vi.spyOn(navigator, "hardwareConcurrency", "get").mockReturnValue(8);
    Object.defineProperty(navigator, "deviceMemory", {
      configurable: true,
      get: () => 8,
    });
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      get: () => ({ saveData: false }),
    });

    initPerformanceMonitoring();
    expect(document.documentElement.classList.contains("perf-high")).toBe(true);
    expect(document.documentElement.classList.contains("perf-low")).toBe(false);
  });

  it("flags low-end when CPU cores <= 4", () => {
    vi.spyOn(navigator, "hardwareConcurrency", "get").mockReturnValue(4);
    Object.defineProperty(navigator, "deviceMemory", { configurable: true, get: () => 8 });
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      get: () => ({ saveData: false }),
    });

    initPerformanceMonitoring();
    expect(document.documentElement.classList.contains("perf-low")).toBe(true);
    expect(document.documentElement.classList.contains("perf-high")).toBe(false);
  });

  it("flags low-end when deviceMemory < 4", () => {
    vi.spyOn(navigator, "hardwareConcurrency", "get").mockReturnValue(8);
    Object.defineProperty(navigator, "deviceMemory", { configurable: true, get: () => 2 });
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      get: () => ({ saveData: false }),
    });

    initPerformanceMonitoring();
    expect(document.documentElement.classList.contains("perf-low")).toBe(true);
  });

  it("flags low-end when navigator.connection.saveData is true", () => {
    vi.spyOn(navigator, "hardwareConcurrency", "get").mockReturnValue(16);
    Object.defineProperty(navigator, "deviceMemory", { configurable: true, get: () => 16 });
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      get: () => ({ saveData: true }),
    });

    initPerformanceMonitoring();
    expect(document.documentElement.classList.contains("perf-low")).toBe(true);
  });
});
