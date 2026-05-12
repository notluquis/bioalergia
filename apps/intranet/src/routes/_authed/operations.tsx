import { createFileRoute, Outlet } from "@tanstack/react-router";

// Operations section layout
export const Route = createFileRoute("/_authed/operations")({
  component: () => <Outlet />,
});
