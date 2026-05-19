import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const ClinicalSeriesPage = lazy(() =>
  import("@/features/clinical-series/pages/ClinicalSeriesPage").then((m) => ({
    default: m.ClinicalSeriesPage,
  }))
);

const routeApi = getRouteApi("/_authed/clinical/");

export const Route = createFileRoute("/_authed/clinical/")({
  component: () => (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <LoadingSpinner label="Cargando series clínicas" />
        </div>
      }
    >
      <ClinicalSeriesPage />
    </Suspense>
  ),
  staticData: {
    nav: { iconKey: "ListChecks", label: "Series — listado", order: 10, section: "Clínica" },
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
