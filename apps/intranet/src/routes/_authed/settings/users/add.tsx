import { createFileRoute, getRouteApi } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/settings/users/add")({
  beforeLoad: () => {
    const routeApi = getRouteApi("/_authed/settings/users/add");
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw routeApi.redirect({ to: "/settings/users" });
  },
  component: () => null,
});
