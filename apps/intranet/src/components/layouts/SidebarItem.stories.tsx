import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Calendar, Home, Users } from "lucide-react";

import type { NavItem } from "@/lib/nav-generator";

import { SidebarItem } from "./SidebarItem";

const meta: Meta<typeof SidebarItem> = {
  title: "Layouts/SidebarItem",
  component: SidebarItem,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Item del sidebar lateral. Layout responsive via Tailwind (`md:` para slim icon-only desktop, defaults para mobile drawer). El estado activo se calcula vía `Link` de TanStack Router (matching exacto). Las stories simulan ambos breakpoints variando el ancho del wrapper — el componente reacciona vía CSS sin recibir prop de viewport.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof SidebarItem>;

const HOME_ITEM: NavItem = { icon: Home, label: "Inicio", to: "/" };
const PATIENTS_ITEM: NavItem = { icon: Users, label: "Pacientes", to: "/pacientes" };
const CALENDAR_ITEM: NavItem = { icon: Calendar, label: "Agenda", to: "/agenda" };

function buildRouter(initialPath: string, slim: boolean) {
  const rootRoute = createRootRoute({
    component: () => (
      <div
        className={
          slim
            ? "flex w-16 flex-col items-center gap-2 rounded-2xl border border-default-100 bg-background/80 p-2"
            : "flex w-64 flex-col gap-1 rounded-2xl border border-default-100 bg-background/80 p-3"
        }
      >
        <SidebarItem item={HOME_ITEM} onNavigate={() => {}} />
        <SidebarItem item={PATIENTS_ITEM} onNavigate={() => {}} />
        <SidebarItem item={CALENDAR_ITEM} onNavigate={() => {}} />
        <Outlet />
      </div>
    ),
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => null,
  });
  const patientsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/pacientes",
    component: () => null,
  });
  const calendarRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/agenda",
    component: () => null,
  });
  return createRouter({
    routeTree: rootRoute.addChildren([indexRoute, patientsRoute, calendarRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
}

// Slim desktop rail: parent w-16, `md:` styles kick in at >= 768px which
// Storybook viewport hits by default. The CSS-responsive component
// auto-collapses to icon-only.
export const DesktopSlim: Story = {
  render: () => <RouterProvider router={buildRouter("/", true)} />,
};

export const DesktopActivePatients: Story = {
  render: () => <RouterProvider router={buildRouter("/pacientes", true)} />,
};

// Mobile drawer-style: parent w-64 to simulate the drawer width. Storybook
// `viewports` addon can switch to a mobile viewport for SSR fidelity.
export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
  render: () => <RouterProvider router={buildRouter("/agenda", false)} />,
};
