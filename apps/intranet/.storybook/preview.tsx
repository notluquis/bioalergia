/// <reference types="vite/client" />

import { withThemeByDataAttribute } from "@storybook/addon-themes";
import { initialize, mswLoader } from "msw-storybook-addon";

import "../src/index.css";
import { allModes } from "./modes";
import { handlers } from "./msw-handlers";

initialize({ onUnhandledRequest: "bypass" });

const preview = {
  decorators: [
    withThemeByDataAttribute({
      themes: {
        light: "light",
        dark: "dark",
      },
      defaultTheme: "light",
      attributeName: "data-theme",
    }),
  ],
  loaders: [mswLoader],
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "padded",
    // Viewport defs referenced by Chromatic modes (see modes.ts) and the
    // Storybook viewport addon. Three breakpoints align with Playwright
    // viewport projects so a Chromatic regression narrows to the same
    // bucket a Playwright failure would point at.
    viewport: {
      options: {
        mobile: { name: "Mobile (375)", styles: { width: "375px", height: "740px" } },
        tablet: { name: "Tablet (768)", styles: { width: "768px", height: "1024px" } },
        desktop: { name: "Desktop (1280)", styles: { width: "1280px", height: "800px" } },
      },
    },
    chromatic: {
      // Every story → 6 snapshots (light/dark × 3 viewports). Override
      // per-story by re-exporting `parameters.chromatic.modes` when a
      // mode is irrelevant (e.g. a mobile-only sheet).
      modes: allModes,
    },
    msw: {
      // Default MSW handlers — every oRPC endpoint returns a deterministic
      // fixture or a generic success. Destructive mutations resolve fake
      // success without hitting any DB. Stories opt out / override by
      // re-exporting parameters.msw.handlers.
      handlers,
    },
  },
};

export default preview;
