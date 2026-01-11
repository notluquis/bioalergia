import { createFileRoute, Outlet } from "@tanstack/react-router";

import { ServicesProvider } from "@/features/services/hooks/useServicesOverview";

// Services section layout - provides ServicesProvider context
export const Route = createFileRoute("/_authed/services")({
  component: ServicesLayout,
});

function ServicesLayout() {
  return (
    <ServicesProvider>
      <Outlet />
    </ServicesProvider>
  );
}
