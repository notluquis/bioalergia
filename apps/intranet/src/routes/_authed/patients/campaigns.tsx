import { createFileRoute } from "@tanstack/react-router";
import { PatientCampaignsPage } from "@/features/patient-campaigns/pages/PatientCampaignsPage";

export const Route = createFileRoute("/_authed/patients/campaigns")({
  staticData: {
    nav: { iconKey: "Megaphone", label: "Campañas", order: 20, section: "Pacientes" },
    permission: { action: "read", subject: "PatientCampaign" },
    title: "Pacientes — Campañas",
  },
  component: PatientCampaignsPage,
});
