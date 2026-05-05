import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { ClinicalSeriesPage } from "@/features/clinical-series/pages/ClinicalSeriesPage";

const routeApi = getRouteApi("/_authed/clinical/");

export const Route = createFileRoute("/_authed/clinical/")({
  component: ClinicalSeriesPage,
  staticData: {
    nav: { iconKey: "ListChecks", label: "Series", order: 10, section: "Clínica" },
    permission: { action: "read", subject: "ClinicalSeries" },
    title: "Series clínicas",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "ClinicalSeries")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
});
