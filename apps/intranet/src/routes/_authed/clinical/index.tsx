import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { lazy, Suspense } from "react";

const ClinicalSeriesPage = lazy(() =>
  import("@/features/clinical-series/pages/ClinicalSeriesPage").then((m) => ({
    default: m.ClinicalSeriesPage,
  }))
);

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
    nav: { iconKey: "ListChecks", label: "Series", order: 10, section: "Clínica" },
    permission: { action: "read", subject: "ClinicalSeries" },
    title: "Series clínicas",
  },
  beforeLoad: requirePermission("read", "ClinicalSeries"),
});
