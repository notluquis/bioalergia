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
          "Item del sidebar lateral. En desktop (slim) sólo muestra icono con tooltip; en móvil muestra icono + label dentro de un panel horizontal. El estado activo se calcula vía `Link` de TanStack Router (matching exacto). Estas stories montan un router en memoria para distintas rutas iniciales.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof SidebarItem>;

const HOME_ITEM: NavItem = { icon: Home, label: "Inicio", to: "/" };
const PATIENTS_ITEM: NavItem = { icon: Users, label: "Pacientes", to: "/pacientes" };
const CALENDAR_ITEM: NavItem = { icon: Calendar, label: "Agenda", to: "/agenda" };

function buildRouter(initialPath: string, isMobile: boolean) {
  const rootRoute = createRootRoute({
    component: () => (
      <div
        className={
          isMobile
            ? "flex w-64 flex-col gap-1 rounded-2xl border border-default-100 bg-background/80 p-3"
            : "flex w-16 flex-col items-center gap-2 rounded-2xl border border-default-100 bg-background/80 p-2"
        }
      >
        <SidebarItem isMobile={isMobile} item={HOME_ITEM} onNavigate={() => {}} />
        <SidebarItem isMobile={isMobile} item={PATIENTS_ITEM} onNavigate={() => {}} />
        <SidebarItem isMobile={isMobile} item={CALENDAR_ITEM} onNavigate={() => {}} />
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

export const DesktopSlim: Story = {
  render: () => <RouterProvider router={buildRouter("/", false)} />,
};

export const DesktopActivePatients: Story = {
  render: () => <RouterProvider router={buildRouter("/pacientes", false)} />,
};

export const Mobile: Story = {
  render: () => <RouterProvider router={buildRouter("/agenda", true)} />,
};
