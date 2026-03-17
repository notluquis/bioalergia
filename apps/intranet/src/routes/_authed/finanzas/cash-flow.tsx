import { createFileRoute, redirect } from "@tanstack/react-router";

import { CashFlowPage } from "../../../features/finance/pages/CashFlowPage";

export const Route = createFileRoute("/_authed/finanzas/cash-flow")({
  staticData: {
    nav: { iconKey: "Banknote", label: "Flujo de Caja", order: 1, section: "Finanzas" },
    permission: { action: "read", subject: "Transaction" },
    title: "Flujo de Caja",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Transaction")) {
      throw redirect({ to: "/" });
    }
  },
  component: CashFlowPage,
});
