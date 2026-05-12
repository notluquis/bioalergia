import { createFileRoute, Outlet } from "@tanstack/react-router";

// Finanzas section layout - just renders children (no shared UI needed)
export const Route = createFileRoute("/_authed/finanzas")({
  staticData: {
    breadcrumb: "Finanzas",
  },
  component: () => <Outlet />,
});
