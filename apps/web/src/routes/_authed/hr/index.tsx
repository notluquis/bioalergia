import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/hr/")({
  beforeLoad: () => {
    throw redirect({ to: "/hr/employees" });
  },
});
