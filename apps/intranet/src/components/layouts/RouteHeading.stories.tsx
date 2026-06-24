import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { RouteHeading } from "./RouteHeading";

const meta: Meta<typeof RouteHeading> = {
  title: "Layouts/RouteHeading",
  component: RouteHeading,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Emite exactamente un `<h1>` por ruta autenticada, leyendo `staticData.title` de la ruta hoja activa via `useMatches`. Visualmente oculto (`sr-only`) para no alterar el chrome existente, pero cumple con `page-has-heading-one` de axe / WCAG.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof RouteHeading>;

function buildRouter(title: string | undefined) {
  const rootRoute = createRootRoute({
    component: () => (
      <div className="space-y-2">
        <RouteHeading />
        <p className="text-default-600 text-sm">
          El `h1` queda oculto visualmente. Inspecciona el DOM para verificarlo.
        </p>
        <Outlet />
      </div>
    ),
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    staticData: { title },
    component: () => null,
  });
  return createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
}

export const WithTitle: Story = {
  render: () => <RouterProvider router={buildRouter("Pacientes")} />,
};

export const WithoutTitle: Story = {
  render: () => <RouterProvider router={buildRouter(undefined)} />,
};
