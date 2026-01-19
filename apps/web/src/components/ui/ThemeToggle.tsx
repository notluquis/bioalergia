import { Moon, Sun } from "lucide-react";
import React from "react";

const THEME_KEY = "bioalergia:theme";
type Theme = "dark" | "light" | "system";

export default function ThemeToggle() {
  const [theme, setTheme] = React.useState<Theme>(() => {
    try {
      const raw = localStorage.getItem(THEME_KEY);
      return (raw as null | Theme) ?? "system";
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
    const mql = globalThis.matchMedia("(prefers-color-scheme: dark)");
    mql.addEventListener("change", handle);
    return () => {
      mql.removeEventListener("change", handle);
    };
  }, [theme]);

  // apply theme on mount / change
  React.useEffect(() => {
    const resolved: "dark" | "light" = theme === "system" ? getPreferredThemeFromSystem() : theme;
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

  const resolvedTheme: "dark" | "light" =
    theme === "system" ? getPreferredThemeFromSystem() : theme;
  const isDark = resolvedTheme === "dark";
  const icon = isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />;
  const getLabel = () => {
    if (resolvedTheme === "dark") return "Cambiar a modo claro";
    return "Cambiar a modo oscuro";
  };
  const label = getLabel();

  return (
    <button
      aria-label={label}
      className={`btn btn-circle border-base-300/70 bg-base-100/80 text-base-content border shadow-sm transition-all duration-300 ${
        isDark
          ? "hover:bg-base-200/40 hover:border-primary/60"
          : "hover:bg-base-200/70 hover:border-primary/60"
      }`}
      onClick={toggleTheme}
      type="button"
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

function applyTheme(theme: "dark" | "light") {
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

function getPreferredThemeFromSystem(): "dark" | "light" {
  return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
