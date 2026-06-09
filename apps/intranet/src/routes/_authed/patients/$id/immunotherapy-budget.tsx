import { createFileRoute } from "@tanstack/react-router";
import { ImmunotherapyBudgetPage } from "@/features/patients/pages/ImmunotherapyBudgetPage";

export const Route = createFileRoute("/_authed/patients/$id/immunotherapy-budget")({
  staticData: {
    permission: { action: "create", subject: "Budget" },
    title: "Presupuesto de Inmunoterapia",
    hideFromNav: true,
  },
  component: ImmunotherapyBudgetPage,
});
