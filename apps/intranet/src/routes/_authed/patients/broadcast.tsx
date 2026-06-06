import { createFileRoute } from "@tanstack/react-router";
import { EmailBroadcastPage } from "@/features/email/pages/EmailBroadcastPage";

export const Route = createFileRoute("/_authed/patients/broadcast")({
  staticData: {
    nav: { iconKey: "Mail", label: "Correos a pacientes", order: 21, section: "Pacientes" },
    permission: { action: "read", subject: "PatientCampaign" },
    title: "Pacientes — Correos",
  },
  component: EmailBroadcastPage,
});
