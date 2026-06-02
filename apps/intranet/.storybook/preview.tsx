/// <reference types="vite/client" />

import { I18nProvider } from "@heroui/react";
import type { ReactElement } from "react";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import { initialize, mswLoader } from "msw-storybook-addon";

import "../src/index.css";
// Side-effect import: registers dayjs plugins (utc, timezone, isoWeek, …)
// that production code assumes are extended at boot via main.tsx.
import "../src/lib/dayjs";
import { allModes } from "./modes";
import { handlers } from "./msw-handlers";

initialize({ onUnhandledRequest: "bypass" });

// "ResizeObserver loop completed with undelivered notifications" / "loop limit
// exceeded" are benign per the spec — the browser simply defers the observer
// callback to the next frame. But Vitest's browser runner surfaces the resulting
// uncaught `error` event as a test failure, which flakes stories whose play()
// opens a HeroUI date-picker popover (the calendar resizes for a frame or two
// before settling). Swallow ONLY these two messages so layout can settle without
// failing the assertion; every other error still propagates.
if (typeof window !== "undefined") {
  const RESIZE_OBSERVER_LOOP =
    /ResizeObserver loop (?:completed with undelivered notifications|limit exceeded)/;
  window.addEventListener("error", (event) => {
    if (RESIZE_OBSERVER_LOOP.test(event.message)) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  });
}

const preview = {
  decorators: [
    // Mirror the app root (__root.tsx): React Aria date/number components
    // default to en-US otherwise, so snapshots would diverge from prod's es-CL.
    (Story: () => ReactElement) => (
      <I18nProvider locale="es-CL">
        <Story />
      </I18nProvider>
    ),
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
