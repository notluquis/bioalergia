import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { FarmacovigilanciaPage } from "@/features/immunotherapy/pages/FarmacovigilanciaPage";

export const Route = createFileRoute("/_authed/clinical/farmacovigilancia")({
  staticData: {
    nav: {
      iconKey: "ShieldCheck",
      label: "Farmacovigilancia",
      order: 110,
      section: "Clínica",
    },
    permission: { action: "read", subject: "ClinicalSeries" },
    title: "Farmacovigilancia",
  },
  beforeLoad: requirePermission("read", "ClinicalSeries"),
  component: FarmacovigilanciaPage,
});
