import { createFileRoute } from "@tanstack/react-router";
import { PatientCampaignsPage } from "@/features/patient-campaigns/pages/PatientCampaignsPage";

export const Route = createFileRoute("/_authed/patients/campaigns")({
  staticData: {
    nav: { iconKey: "Megaphone", label: "Campañas", order: 2, section: "Servicios" },
    permission: { action: "read", subject: "PatientCampaign" },
  },
  component: PatientCampaignsPage,
});
