import { createFileRoute } from "@tanstack/react-router";
import { ClinicalSeriesPage } from "@/features/clinical-series/pages/ClinicalSeriesPage";

export const Route = createFileRoute("/_authed/operations/clinical-series")({
  component: ClinicalSeriesPage,
  staticData: {
    nav: { iconKey: "Calendar", label: "Series Clínicas", order: 4, section: "Operaciones" },
  },
});
