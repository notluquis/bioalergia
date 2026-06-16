import { createFileRoute } from "@tanstack/react-router";
import { ImmunotherapyBudgetPage } from "@/features/patients/pages/ImmunotherapyBudgetPage";

export const Route = createFileRoute("/_authed/patients/$id/immunotherapy-budget")({
  staticData: {
    permission: { action: "create", subject: "Budget" },
    title: "Presupuesto de Inmunoterapia",
    hideFromNav: true,
  },
  // prefillIds: ids de catálogo (alg_*) separados por "," desde la prescripción
  // SCIT, para precargar el selector de alérgenos por id (fuente de verdad única).
  validateSearch: (search: Record<string, unknown>): { prefillIds?: string } => ({
    prefillIds: typeof search.prefillIds === "string" ? search.prefillIds : undefined,
  }),
  component: ImmunotherapyBudgetPage,
});
