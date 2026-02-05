import React from "react";

const THEME_KEY = "bioalergia:theme";
export type Theme = "dark" | "light" | "system";

export function useTheme() {
  // Initialize state from localStorage or default to 'system'
  const [theme, setTheme] = React.useState<Theme>(() => {
    try {
      if (typeof window === "undefined") {
        return "system";
      }
      const raw = localStorage.getItem(THEME_KEY);
      return (raw as null | Theme) ?? "system";
    } catch {
      return "system";
    }
  });

  // Helper to determining system preference
  const getPreferredThemeFromSystem = React.useCallback((): "dark" | "light" => {
    if (typeof window === "undefined") {
      return "light";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }, []);

  // Sync with system changes when in 'system' mode
  React.useEffect(() => {
    if (theme !== "system") {
      return;
    }

    const handleMediaChange = () => {
      applyTheme(getPreferredThemeFromSystem());
    };

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    mql.addEventListener("change", handleMediaChange);
    return () => mql.removeEventListener("change", handleMediaChange);
  }, [theme, getPreferredThemeFromSystem]);

  // Apply theme side-effects (class & localStorage)
  React.useEffect(() => {
    const resolved = theme === "system" ? getPreferredThemeFromSystem() : theme;
    applyTheme(resolved);

    try {
      if (theme === "system") {
        localStorage.removeItem(THEME_KEY);
      } else {
        localStorage.setItem(THEME_KEY, theme);
      }
    } catch {
      // ignore errors
    }
  }, [theme, getPreferredThemeFromSystem]);

  const toggleTheme = React.useCallback(() => {
    setTheme((prev) => {
      // Logic: If explicitly set, toggle to opposite.
      // If system, toggle to the opposite of what system currently is.
      const currentResolved = prev === "system" ? getPreferredThemeFromSystem() : prev;
      return currentResolved === "dark" ? "light" : "dark";
    });
  }, [getPreferredThemeFromSystem]);

  const resolvedTheme = theme === "system" ? getPreferredThemeFromSystem() : theme;

  return {
    theme,
    setTheme,
    toggleTheme,
    resolvedTheme,
    isDark: resolvedTheme === "dark",
  };
}

// Side-effect function to manipulate DOM
function applyTheme(theme: "dark" | "light") {
  if (typeof document === "undefined") {
    return;
  }
  const html = document.documentElement;

  // Apply Tailwind 'dark' class
  if (theme === "dark") {
    html.classList.add("dark");
    // Keep legacy compat if needed, but HeroUI v3 mainly uses .dark
    html.dataset.theme = "bioalergia-dark";
  } else {
    html.classList.remove("dark");
    html.dataset.theme = "bioalergia";
  }
}
