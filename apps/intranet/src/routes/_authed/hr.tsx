import { createFileRoute, Outlet } from "@tanstack/react-router";

// HR section layout
export const Route = createFileRoute("/_authed/hr")({
  component: () => <Outlet />,
});
