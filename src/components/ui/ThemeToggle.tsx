import React from "react";
import { Moon, Sun } from "lucide-react";

const THEME_KEY = "bioalergia:theme";
type Theme = "light" | "dark" | "system";

function getPreferredThemeFromSystem(): "light" | "dark" {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: "light" | "dark") {
  const html = document.documentElement;
  // Apply both DaisyUI data-theme and Tailwind dark class for full compatibility
  if (theme === "dark") {
    html.setAttribute("data-theme", "bioalergia-dark");
    html.classList.add("dark");
  } else {
    html.setAttribute("data-theme", "bioalergia");
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
    const mql =
      typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
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
  const label =
    resolvedTheme === "dark"
      ? "Cambiar a modo claro"
      : resolvedTheme === "light"
        ? "Cambiar a modo oscuro"
        : "Cambiar tema";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`btn btn-circle border border-base-300/60 bg-base-100/70 text-base-content shadow-sm transition-all duration-300 ${
        isDark ? "hover:bg-base-200/50" : "hover:bg-base-200"
      }`}
      aria-label={label}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full transition-all duration-300 ${
          isDark
            ? "bg-gradient-to-r from-slate-800 to-indigo-700 text-amber-100"
            : "bg-gradient-to-r from-amber-200 to-rose-200 text-slate-800"
        }`}
      >
        {icon}
      </span>
    </button>
  );
}
