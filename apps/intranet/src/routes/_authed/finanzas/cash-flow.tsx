import { createFileRoute, redirect } from "@tanstack/react-router";

import { CashFlowPage } from "../../../features/finance/pages/CashFlowPage";

export const Route = createFileRoute("/_authed/finanzas/cash-flow")({
  staticData: {
    nav: { iconKey: "Wallet", label: "Flujo de Caja", order: 20, section: "Finanzas" },
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
