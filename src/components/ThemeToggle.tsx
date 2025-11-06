import React from "react";

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

  const setLight = () => setTheme("light");
  const setDark = () => setTheme("dark");
  const setSystem = () => setTheme("system");

  const currentLabel = theme === "system" ? "Sistema" : theme === "dark" ? "Oscuro" : "Claro";

  return (
    <div className="dropdown dropdown-end">
      <label
        tabIndex={0}
        className="btn btn-ghost btn-circle p-2"
        aria-haspopup="menu"
        aria-label={`Tema actual: ${currentLabel}`}
      >
        {/* simple theme icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-base-content"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 3a1 1 0 011 1v1.07a7.002 7.002 0 015.657 5.657H20a1 1 0 011 1v2a1 1 0 01-1 1h-1.343A7.002 7.002 0 0113 19.93V21a1 1 0 01-1 1h-2a1 1 0 01-1-1v-1.07a7.002 7.002 0 01-5.657-5.657H4a1 1 0 01-1-1v-2a1 1 0 011-1h1.343A7.002 7.002 0 0111 4.07V3a1 1 0 011-1h0z" />
        </svg>
      </label>
      <div
        tabIndex={0}
        className="dropdown-content menu p-3 shadow bg-base-100 rounded-box w-44"
        role="menu"
        aria-label="Seleccionar tema"
      >
        <fieldset className="space-y-2">
          <legend className="sr-only">Seleccionar tema</legend>
          <label className="flex items-center gap-3">
            <input
              type="radio"
              name="theme"
              value="light"
              checked={theme === "light"}
              onChange={setLight}
              className="radio radio-sm"
            />
            <span className="ml-1">Claro</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={theme === "dark"}
              onChange={setDark}
              className="radio radio-sm"
            />
            <span className="ml-1">Oscuro</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="radio"
              name="theme"
              value="system"
              checked={theme === "system"}
              onChange={setSystem}
              className="radio radio-sm"
            />
            <span className="ml-1">Sistema</span>
          </label>
        </fieldset>
      </div>
    </div>
  );
}
