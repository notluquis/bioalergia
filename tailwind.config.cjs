module.exports = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // Keep content paths focused on project source; removed flowbite node_modules paths
  ],
  theme: {
    extend: {},
  },
  plugins: [
    // daisyUI plugin (provides UI components via Tailwind utility classes)
    require("daisyui"),
  ],
  daisyui: {
    logs: false,
    styled: true,
    /* Include only the daisyUI components we use to keep CSS size small and avoid style clashes. */
    include:
      "button, input, select, modal, card, collapse, dropdown, badge, alert, file-input, table, navbar, drawer, menu, tooltip",
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
          primary: "#0e64b7" /* Brand blue, kept from original */,
          "primary-content": "#ffffff",
          secondary: "#f1a722",
          "secondary-content": "#102542",
          accent: "#0ea5a4",
          neutral: "#f5f5f5" /* True neutral, not white-biased */,
          "base-100": "#ffffff" /* Pure white background */,
          "base-200": "#f5f5f5" /* Light gray */,
          "base-300": "#e5e5e5" /* Medium gray */,
          info: "#3abff8",
          success: "#36d399",
          warning: "#fbbd23",
          error: "#f87272",
          /* brand tokens (available as CSS variables via data-theme) */
          "--brand-primary": "#0e64b7",
          "--brand-secondary": "#f1a722",
          "--brand-primary-rgb": "14 100 183",
          "--brand-secondary-rgb": "241 167 34",
          /* Apple-like shadows: soft and subtle */
          "--shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.05)",
          "--shadow-md": "0 4px 6px rgba(0, 0, 0, 0.07)",
          "--shadow-lg": "0 10px 24px rgba(0, 0, 0, 0.1)",
          /* Animation easing curves */
          "--ease-apple": "cubic-bezier(0.4, 0, 0.2, 1)",
          "--ease-spring": "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        },
      },
      {
        /* Branded dark theme: bioalergia-dark — with Apple-like neutral aesthetics */
        "bioalergia-dark": {
          primary: "#7fb6ff",
          "primary-content": "#ffffff",
          secondary: "#ffc782",
          "secondary-content": "#ffffff",
          accent: "#0ea5a4",
          neutral: "#2a2a2a" /* True neutral gray */,
          "base-100": "#000000" /* Pure black background */,
          "base-200": "#1a1a1a" /* Dark gray */,
          "base-300": "#2a2a2a" /* Medium gray */,
          info: "#60a5fa",
          success: "#34d399",
          warning: "#fbbd23",
          error: "#fb7185",
          /* brand tokens */
          "--brand-primary": "#7fb6ff",
          "--brand-secondary": "#ffc782",
          "--brand-primary-rgb": "127 182 255",
          "--brand-secondary-rgb": "255 199 130",
          /* Apple-like shadows: soft and subtle for dark mode */
          "--shadow-sm": "0 1px 2px rgba(255, 255, 255, 0.03)",
          "--shadow-md": "0 4px 6px rgba(255, 255, 255, 0.05)",
          "--shadow-lg": "0 10px 24px rgba(255, 255, 255, 0.08)",
          /* Animation easing curves */
          "--ease-apple": "cubic-bezier(0.4, 0, 0.2, 1)",
          "--ease-spring": "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        },
      },
    ],
    base: true,
  },
};
