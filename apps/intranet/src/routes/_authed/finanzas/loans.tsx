import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { loanKeys } from "@/features/finance/loans/queries";
import { LoansPage } from "@/features/finance/loans/pages/LoansPage";

export const Route = createFileRoute("/_authed/finanzas/loans")({
  staticData: {
    nav: { iconKey: "PiggyBank", label: "Préstamos", order: 80, section: "Finanzas" },
    permission: { action: "read", subject: "Loan" },
    title: "Gestión de préstamos",
  },
  validateSearch: (search: Record<string, unknown>): { loan?: string } => ({
    loan: typeof search.loan === "string" ? search.loan : undefined,
  }),
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Loan")) {
      const routeApi = getRouteApi("/_authed/finanzas/loans");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: LoansPage,

  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(loanKeys.lists());
  },
});
