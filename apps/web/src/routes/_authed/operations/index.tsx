import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/operations/")({
  beforeLoad: () => {
    throw redirect({ to: "/operations/inventory" });
  },
});
