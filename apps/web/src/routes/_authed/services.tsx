import { createFileRoute, Outlet } from "@tanstack/react-router";

// Services section layout
export const Route = createFileRoute("/_authed/services")({
  component: ServicesLayout,
});

function ServicesLayout() {
  return <Outlet />;
}
