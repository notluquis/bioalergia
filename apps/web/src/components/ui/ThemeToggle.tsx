import { Moon, Sun } from "lucide-react";
import React from "react";

const THEME_KEY = "bioalergia:theme";
type Theme = "light" | "dark" | "system";

function getPreferredThemeFromSystem(): "light" | "dark" {
  if (!globalThis.matchMedia) return "dark";
  return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: "light" | "dark") {
  const html = document.documentElement;
  // Apply both DaisyUI data-theme and Tailwind dark class for full compatibility
  if (theme === "dark") {
    html.dataset.theme = "bioalergia-dark";
    html.classList.add("dark");
  } else {
    html.dataset.theme = "bioalergia";
    html.classList.remove("dark");
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = React.useState<Theme>(() => {
    try {
      const raw = localStorage.getItem(THEME_KEY);
      return (raw as Theme) || "system";
    } catch {
      return "system";
    }
  });

  // sync with system when in 'system' mode
  React.useEffect(() => {
    const handle = () => {
      if (theme !== "system") return;
      applyTheme(getPreferredThemeFromSystem());
    };
    const mql = globalThis.matchMedia ? globalThis.matchMedia("(prefers-color-scheme: dark)") : null;
    mql?.addEventListener?.("change", handle);
    return () => mql?.removeEventListener?.("change", handle);
  }, [theme]);

  // apply theme on mount / change
  React.useEffect(() => {
    const resolved: "light" | "dark" = theme === "system" ? getPreferredThemeFromSystem() : (theme as "light" | "dark");
    applyTheme(resolved);
    try {
      if (theme === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("light");
    else setTheme(getPreferredThemeFromSystem() === "dark" ? "light" : "dark");
  };

  const resolvedTheme: "light" | "dark" = theme === "system" ? getPreferredThemeFromSystem() : theme;
  const isDark = resolvedTheme === "dark";
  const icon = isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />;
  const getLabel = () => {
    if (resolvedTheme === "dark") return "Cambiar a modo claro";
    if (resolvedTheme === "light") return "Cambiar a modo oscuro";
    return "Cambiar tema";
  };
  const label = getLabel();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`btn btn-circle border-base-300/70 bg-base-100/80 text-base-content border shadow-sm transition-all duration-300 ${
        isDark ? "hover:bg-base-200/40 hover:border-primary/60" : "hover:bg-base-200/70 hover:border-primary/60"
      }`}
      aria-label={label}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full transition-all duration-300 ${
          isDark
            ? "from-base-200 via-primary/40 to-primary text-primary-content shadow-primary/20 bg-linear-to-br shadow-inner"
            : "from-base-100 via-primary/10 to-primary/70 text-primary shadow-primary/10 bg-linear-to-br shadow-inner"
        }`}
      >
        {icon}
      </span>
    </button>
  );
}
