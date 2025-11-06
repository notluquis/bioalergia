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
    /* define a theme object that delegates to CSS variables so branding stays centralized */
    themes: [
      {
        /* Branded light theme: bioalergia */
        bioalergia: {
          primary: "#0e64b7",
          "primary-content": "#ffffff",
          secondary: "#f1a722",
          "secondary-content": "#102542",
          accent: "#0ea5a4",
          neutral: "#ffffff",
          "base-100": "#ecf4fc",
          "base-200": "#d9e8f7",
          "base-300": "#c6dcf2",
          info: "#3abff8",
          success: "#36d399",
          warning: "#fbbd23",
          error: "#f87272",
          /* brand tokens (available as CSS variables via data-theme) */
          "--brand-primary": "#0e64b7",
          "--brand-secondary": "#f1a722",
          "--brand-primary-rgb": "14 100 183",
          "--brand-secondary-rgb": "241 167 34",
          /* Note: glass tokens removed — use DaisyUI semantic tokens like --color-base-200 / --color-base-100 instead */
        },
      },
      {
        /* Branded dark theme: bioalergia-dark */
        "bioalergia-dark": {
          primary: "#7fb6ff",
          "primary-content": "#071422",
          secondary: "#ffc782",
          "secondary-content": "#071422",
          accent: "#0ea5a4",
          neutral: "#0b1724",
          "base-100": "#071422",
          "base-200": "#0d1f33",
          "base-300": "#132944",
          info: "#60a5fa",
          success: "#34d399",
          warning: "#fbbd23",
          error: "#fb7185",
          /* brand tokens */
          "--brand-primary": "#7fb6ff",
          "--brand-secondary": "#ffc782",
          "--brand-primary-rgb": "127 182 255",
          "--brand-secondary-rgb": "255 199 130",
          /* Note: glass tokens removed for dark theme as well — prefer DaisyUI semantic tokens */
        },
      },
    ],
    base: true,
  },
};
