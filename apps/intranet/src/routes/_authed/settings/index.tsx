import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/settings/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/users", search: { tab: "roles" }, replace: true });
  },
});
