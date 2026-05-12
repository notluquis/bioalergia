import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/wa-cloud")({
  staticData: { breadcrumb: "WhatsApp Cloud" },
  component: () => <Outlet />,
});
