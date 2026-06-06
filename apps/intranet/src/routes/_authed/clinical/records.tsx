import {} from "@heroui/react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const ClinicalRecordsWorkspacePage = lazy(() =>
  import("@/features/clinical-records/pages/ClinicalRecordsWorkspacePage").then((m) => ({
    default: m.ClinicalRecordsWorkspacePage,
  }))
);

const routeApi = getRouteApi("/_authed/clinical/records");

export const Route = createFileRoute("/_authed/clinical/records")({
  component: () => (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <LoadingSpinner label="Cargando fichas clínicas" />
        </div>
      }
    >
      <ClinicalRecordsWorkspacePage />
    </Suspense>
  ),
  staticData: {
    nav: { iconKey: "ClipboardList", label: "Fichas clínicas", order: 12, section: "Clínica" },
    permission: { action: "read", subject: "ClinicalSeries" },
    title: "Fichas clínicas",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "ClinicalSeries")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
});
