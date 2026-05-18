import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/settings/mercadolibre")({
  staticData: { hideFromNav: true },
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({ to: "/store", search: { tab: "mercadolibre" }, replace: true });
  },
  component: () => null,
});
