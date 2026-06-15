import { createFileRoute } from "@tanstack/react-router";
import { ImmunotherapyBudgetPage } from "@/features/patients/pages/ImmunotherapyBudgetPage";

export const Route = createFileRoute("/_authed/patients/$id/immunotherapy-budget")({
  staticData: {
    permission: { action: "create", subject: "Budget" },
    title: "Presupuesto de Inmunoterapia",
    hideFromNav: true,
  },
  // prefillAllergens: nombres científicos separados por "|" desde la prescripción
  // SCIT, para precargar el selector de alérgenos (match best-effort por nombre).
  validateSearch: (search: Record<string, unknown>): { prefillAllergens?: string } => ({
    prefillAllergens:
      typeof search.prefillAllergens === "string" ? search.prefillAllergens : undefined,
  }),
  component: ImmunotherapyBudgetPage,
});
