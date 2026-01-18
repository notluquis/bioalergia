module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  daisyui: {
    base: true,
    /* Include only the daisyUI components we use to keep CSS size small and avoid style clashes. */
    include:
      "button, input, select, modal, card, collapse, dropdown, badge, alert, file-input, table, navbar, drawer, menu, tooltip",
    logs: false,
    styled: true,
    /* Apple-like Design System:
       - Neutral backgrounds: pure white (#ffffff) light mode, pure black (#000000) dark mode
       - Semantic color tokens from DaisyUI (primary, secondary, success, error, warning, info)
       - Generous spacing and typography for premium feel
       - Soft, subtle shadows using oklch() for theme-aware rendering
       - Custom easing curves for smooth animations
       - NO hard-coded colors or RGBA values (all use CSS variables or oklch())
       
       To add new colors: extend the theme object below with semantic tokens only.
       To add custom shadows: use oklch(var(--bc) / opacity) for theme awareness.
    */
    themes: [
      {
        /* Branded light theme: bioalergia — with Apple-like neutral aesthetics */
        bioalergia: {
          /* brand tokens (available as CSS variables via data-theme) */
          "--brand-primary": "#0e64b7",
          "--brand-primary-rgb": "14 100 183",
          "--brand-secondary": "#f1a722",
          "--brand-secondary-rgb": "241 167 34",
          /* Animation easing curves */
          "--ease-apple": "cubic-bezier(0.4, 0, 0.2, 1)",
          "--ease-spring": "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          "--shadow-lg": "0 10px 24px rgba(0, 0, 0, 0.1)",
          "--shadow-md": "0 4px 6px rgba(0, 0, 0, 0.07)",
          /* Apple-like shadows: soft and subtle */
          "--shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.05)",
          accent: "oklch(70% 0.15 180)" /* Teal */,
          "base-100": "oklch(100% 0 0)" /* White */,
          "base-200": "oklch(97% 0 0)",
          "base-300": "oklch(92% 0 0)",
          "base-content": "oklch(20% 0.04 260)",
          error: "oklch(60% 0.18 25)",
          info: "oklch(70% 0.14 240)",
          neutral: "oklch(96% 0.01 0)" /* Neutral Gray */,
          /* P3 Gamut (OKLCH) - 2026 Standard */
          primary: "oklch(52% 0.16 257)" /* Deep Brand Blue */,
          "primary-content": "oklch(100% 0 0)",
          secondary: "oklch(78% 0.16 70)" /* Vibrant Gold */,
          "secondary-content": "oklch(20% 0.05 260)",
          success: "oklch(65% 0.18 145)",
          warning: "oklch(75% 0.16 55)",
        },
      },
      {
        /* Branded dark theme: bioalergia-dark — with Apple-like neutral aesthetics */
        "bioalergia-dark": {
          /* brand tokens */
          "--brand-primary": "#7fb6ff",
          "--brand-primary-rgb": "127 182 255",
          "--brand-secondary": "#ffc782",
          "--brand-secondary-rgb": "255 199 130",
          /* Animation easing curves */
          "--ease-apple": "cubic-bezier(0.4, 0, 0.2, 1)",
          "--ease-spring": "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          "--shadow-lg": "0 10px 24px rgba(255, 255, 255, 0.08)",
          "--shadow-md": "0 4px 6px rgba(255, 255, 255, 0.05)",
          /* Apple-like shadows: soft and subtle for dark mode */
          "--shadow-sm": "0 1px 2px rgba(255, 255, 255, 0.03)",
          accent: "oklch(70% 0.15 180)",
          "base-100": "oklch(0% 0 0)" /* Pure Black */,
          "base-200": "oklch(12% 0 0)" /* Deep Gray */,
          "base-300": "oklch(18% 0 0)",
          error: "oklch(70% 0.18 20)",
          info: "oklch(70% 0.14 240)",
          neutral: "oklch(26% 0 0)" /* Dark Gray */,
          /* P3 Gamut (OKLCH) - Dark Mode */
          primary: "oklch(70% 0.14 255)" /* Lighter Blue */,
          "primary-content": "oklch(100% 0 0)",
          secondary: "oklch(82% 0.14 75)" /* Lighter Gold */,
          "secondary-content": "oklch(100% 0 0)",
          success: "oklch(75% 0.16 150)",
          warning: "oklch(80% 0.16 85)",
        },
      },
    ],
  },
  darkMode: "class",
  plugins: [
    // daisyUI plugin (provides UI components via Tailwind utility classes)
    /* eslint-disable @typescript-eslint/no-require-imports */
    require("daisyui"),
    require("@iconify/tailwind").addDynamicIconSelectors(),
  ],
  theme: {
    extend: {},
  },
};
