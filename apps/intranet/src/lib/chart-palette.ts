import { useEffect, useState } from "react";

const PALETTE_VAR_NAMES = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--chart-6",
  "--chart-7",
  "--chart-8",
  "--chart-9",
  "--chart-10",
  "--chart-11",
  "--chart-12",
] as const;

interface ChartPalette {
  colors: string[];
  grid: string;
  text: string;
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;
  default: string;
}

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function readPalette(): ChartPalette {
  return {
    colors: PALETTE_VAR_NAMES.map((name, i) => readVar(name, `oklch(60% 0.16 ${i * 30})`)),
    grid: readVar("--chart-grid", "oklch(90% 0.004 260)"),
    text: readVar("--chart-text", "oklch(45% 0.016 260)"),
    primary: readVar("--primary", "oklch(60% 0.17 257)"),
    secondary: readVar("--secondary", "oklch(70% 0.14 70)"),
    success: readVar("--success", "oklch(65% 0.18 145)"),
    warning: readVar("--warning", "oklch(75% 0.16 55)"),
    danger: readVar("--danger", "oklch(60% 0.18 25)"),
    default: readVar("--default-500", "oklch(55% 0.012 260)"),
  };
}

/**
 * Returns the current chart palette resolved from CSS variables.
 * Re-reads when the document theme attribute or class flips so charts
 * recolor on theme change without a full reload.
 */
export function useChartPalette(): ChartPalette {
  const [palette, setPalette] = useState<ChartPalette>(() => readPalette());

  useEffect(() => {
    const update = () => setPalette(readPalette());
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => obs.disconnect();
  }, []);

  return palette;
}
