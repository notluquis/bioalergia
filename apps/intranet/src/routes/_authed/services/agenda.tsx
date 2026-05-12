import { createFileRoute, getRouteApi } from "@tanstack/react-router";

// Redirect to the agenda tab in the services page
export const Route = createFileRoute("/_authed/services/agenda")({
  staticData: {
    permission: { action: "read", subject: "ServiceAgenda" },
    title: "Agenda de servicios",
    breadcrumb: "Agenda",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "ServiceAgenda")) {
      const routeApi = getRouteApi("/_authed/services/agenda");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
    // Redirect to services page (tab selection is done locally)
    const routeApi = getRouteApi("/_authed/services/agenda");
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw routeApi.redirect({ to: "/services" });
  },
});
