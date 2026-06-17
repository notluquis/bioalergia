import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { ClinicalConsentPage } from "@/features/clinical-consent/pages/ClinicalConsentPage";

export const Route = createFileRoute("/_authed/settings/clinical-consent")({
  staticData: {
    nav: {
      iconKey: "ClipboardCheck",
      label: "Consentimiento clínico",
      order: 101,
      section: "Sistema",
    },
    permission: { action: "read", subject: "Setting" },
    title: "Configuración — Consentimiento informado clínico",
  },
  beforeLoad: requirePermission("read", "Setting"),
  component: ClinicalConsentPage,
});
