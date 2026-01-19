import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const CalendarSettingsPage = lazy(() => import("@/pages/settings/CalendarSettingsPage"));

export const Route = createFileRoute("/_authed/settings/calendar")({
  staticData: {
    nav: { iconKey: "Calendar", label: "Conf. Calendario", order: 3, section: "Sistema" },
    permission: { action: "update", subject: "CalendarSetting" },
  },
  beforeLoad: ({ context }) => {
    if (!context.auth.can("update", "CalendarSetting")) {
      const routeApi = getRouteApi("/_authed/settings/calendar");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <CalendarSettingsPage />
    </Suspense>
  ),
});
