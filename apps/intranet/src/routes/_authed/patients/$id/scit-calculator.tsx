import { createFileRoute } from "@tanstack/react-router";
import { PatientScitCalculatorPage } from "@/features/immunotherapy/pages/PatientScitCalculatorPage";

export const Route = createFileRoute("/_authed/patients/$id/scit-calculator")({
  staticData: {
    permission: { action: "create", subject: "ClinicalSeries" },
    title: "Prescripción SCIT",
    hideFromNav: true,
  },
  component: PatientScitCalculatorPage,
});
