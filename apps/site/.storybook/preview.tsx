import { withThemeByDataAttribute } from "@storybook/addon-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { initialize, mswLoader } from "msw-storybook-addon";
import type { ReactNode } from "react";

import "../src/index.css";
import { defaultHandlers } from "./msw-handlers";

initialize();

// ── Router decorator ──────────────────────────────────────────────────────
// Shop components use TanStack Router `<Link to="/producto/$slug">`. A `<Link>`
// outside a RouterProvider throws ("useRouterState … must be used inside a
// RouterProvider"). We mount each story inside a minimal in-memory router whose
// route tree declares every path the shop `<Link>`s reference, so links resolve
// and render without navigating away from the story canvas.
//
// The root route renders `<Outlet/>`; the "/" route renders the story. Sibling
// stub routes exist purely so `<Link>` / `navigate({ to })` can match a known
// path id while the story sits at "/".
const LINKED_PATHS = [
  "/producto/$slug",
  "/tienda",
  "/carrito",
  "/checkout",
  "/mi-cuenta",
  "/mi-cuenta/pedidos",
  "/mi-cuenta/pedidos/$number",
  "/mi-cuenta/direcciones",
  "/buscar",
] as const;

function makeStoryRouter(story: ReactNode) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <>{story}</>,
  });

  const stubRoutes = LINKED_PATHS.map((path) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => <>{story}</>,
    })
  );

  const routeTree = rootRoute.addChildren([indexRoute, ...stubRoutes]);

  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
}

const preview = {
  decorators: [
    // Innermost: provide Query + Router context to the story.
    (Story: () => ReactNode) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
            staleTime: Number.POSITIVE_INFINITY,
          },
          mutations: { retry: false },
        },
      });
      // Fresh router per render so stories don't share navigation state.
      const router = makeStoryRouter(<Story />);
      return (
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      );
    },
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
    msw: { handlers: defaultHandlers },
  },
};

export default preview;
