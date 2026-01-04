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

  if (typeof window === "undefined") return defaultColors;

  try {
    const root = window.getComputedStyle(document.documentElement);
    const getVar = (name: string) => {
      const val = root.getPropertyValue(name).trim();
      return val ? `hsl(${val})` : null;
    };

    const themeColors = [
      getVar("--p"),
      getVar("--s"),
      getVar("--a"),
      getVar("--n"),
      getVar("--in"),
      getVar("--su"),
      getVar("--wa"),
      getVar("--er"),
    ].filter(Boolean) as string[];

    return themeColors.length > 0 ? themeColors : defaultColors;
  } catch {
    return defaultColors;
  }
}
