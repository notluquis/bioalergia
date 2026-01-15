import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const PersonDetailsPage = lazy(() => import("@/pages/settings/PersonDetailsPage"));

export const Route = createFileRoute("/_authed/settings/people/$id")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Person")) {
      const routeApi = getRouteApi("/_authed/settings/people/$id");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <PersonDetailsPage />
    </Suspense>
  ),
});
