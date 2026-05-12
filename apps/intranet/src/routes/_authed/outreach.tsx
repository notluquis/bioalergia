import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/outreach")({
  staticData: { breadcrumb: "Outreach" },
  component: () => <Outlet />,
});
