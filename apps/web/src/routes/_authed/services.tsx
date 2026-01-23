import { createFileRoute, Outlet } from "@tanstack/react-router";

// Services section layout
export const Route = createFileRoute("/_authed/services")({
  staticData: {
    breadcrumb: "Servicios",
  },
  component: ServicesLayout,
});

function ServicesLayout() {
  return <Outlet />;
}
