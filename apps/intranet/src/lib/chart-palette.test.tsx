/**
 * Tests for `useChartPalette` — reads CSS variables on mount + re-reads on
 * theme class/data-attribute flips via MutationObserver.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useChartPalette } from "./chart-palette";

function setVar(name: string, value: string) {
  document.documentElement.style.setProperty(name, value);
}

function clearAllVars() {
  const props = [
    "--chart-1",
    "--chart-2",
    "--chart-grid",
    "--chart-text",
    "--primary",
    "--secondary",
    "--success",
    "--warning",
    "--danger",
    "--default-500",
  ];
  for (const p of props) {
    document.documentElement.style.removeProperty(p);
  }
}

beforeEach(() => {
  clearAllVars();
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  clearAllVars();
});

describe("useChartPalette", () => {
  it("returns 12 chart colours", () => {
    const { result } = renderHook(() => useChartPalette());
    expect(result.current.colors).toHaveLength(12);
  });

  it("reads CSS variables when set on documentElement", () => {
    setVar("--chart-1", "oklch(50% 0.1 200)");
    setVar("--primary", "oklch(60% 0.17 257)");

    const { result } = renderHook(() => useChartPalette());
    expect(result.current.colors[0]).toBe("oklch(50% 0.1 200)");
    expect(result.current.primary).toBe("oklch(60% 0.17 257)");
  });

  it("uses fallback values when the CSS variable is unset", () => {
    const { result } = renderHook(() => useChartPalette());
    // Defaults defined inline in chart-palette.ts:
    expect(result.current.grid).toBe("oklch(90% 0.004 260)");
    expect(result.current.text).toBe("oklch(45% 0.016 260)");
  });

  it("returns all named token fields", () => {
    const { result } = renderHook(() => useChartPalette());
    expect(result.current).toEqual(
      expect.objectContaining({
        colors: expect.any(Array),
        grid: expect.any(String),
        text: expect.any(String),
        primary: expect.any(String),
        secondary: expect.any(String),
        success: expect.any(String),
        warning: expect.any(String),
        danger: expect.any(String),
        default: expect.any(String),
      })
    );
  });

  it("re-reads the palette when data-theme attribute changes", async () => {
    setVar("--primary", "oklch(60% 0.17 257)");
    const { result } = renderHook(() => useChartPalette());
    expect(result.current.primary).toBe("oklch(60% 0.17 257)");

    act(() => {
      setVar("--primary", "oklch(40% 0.2 30)");
      document.documentElement.setAttribute("data-theme", "dark");
    });

    await waitFor(() => {
      expect(result.current.primary).toBe("oklch(40% 0.2 30)");
    });
  });
});
