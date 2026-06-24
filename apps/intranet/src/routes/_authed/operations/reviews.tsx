import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/operations/reviews")({
  beforeLoad: () => {
    throw redirect({ to: "/store", search: { tab: "resenas" } });
  },
});
