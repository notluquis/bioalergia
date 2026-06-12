import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { CalculatorSCITPage } from "@/features/immunotherapy/pages/CalculatorSCITPage";

export const Route = createFileRoute("/_authed/clinical/calculator-scit")({
  staticData: {
    nav: {
      iconKey: "Calculator",
      label: "Calculadora SCIT",
      order: 100,
      section: "Clínica",
    },
    permission: { action: "read", subject: "ClinicalSeries" },
    title: "Calculadora SCIT",
  },
  beforeLoad: requirePermission("read", "ClinicalSeries"),
  component: CalculatorSCITPage,
});
