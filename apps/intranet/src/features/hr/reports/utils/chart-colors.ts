/**
 * Chart color palette with theme support
 */
export function getChartColors(): string[] {
  const defaultColors = [
    "hsl(220 70% 50%)", // Blue
    "hsl(160 70% 40%)", // Emerald
    "hsl(30 80% 55%)", // Orange
    "hsl(340 75% 55%)", // Pink
    "hsl(270 70% 60%)", // Purple
    "hsl(190 80% 40%)", // Cyan
    "hsl(10 80% 55%)", // Red
    "hsl(290 70% 55%)", // Magenta
  ];

  // Check for DOM environment
  if (!("window" in globalThis) || !globalThis.document) {
    return defaultColors;
  }

  try {
    const styles = globalThis.window.getComputedStyle(document.documentElement);
    const getVar = (name: string) => {
      const val = styles.getPropertyValue(name).trim();
      return val || null;
    };

    const themeColors = [
      getVar("--color-primary"),
      getVar("--color-secondary"),
      getVar("--color-info"),
      getVar("--color-success"),
      getVar("--color-warning"),
      getVar("--color-danger"),
      getVar("--color-foreground"),
    ].filter(Boolean) as string[];

    return themeColors.length > 0 ? themeColors : defaultColors;
  } catch {
    return defaultColors;
  }
}
