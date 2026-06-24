import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { lazy, Suspense } from "react";

// Lazy: CashFlowPage is ~2200 LOC, contains charts + Recharts. Split out so
// the rest of the bundle stays small for users that never open this route.
const CashFlowPage = lazy(() =>
  import("../../../features/finance/pages/CashFlowPage").then((m) => ({
    default: m.CashFlowPage,
  }))
);

export const Route = createFileRoute("/_authed/finanzas/cash-flow")({
  staticData: {
    nav: { iconKey: "Wallet", label: "Flujo de Caja", order: 20, section: "Finanzas" },
    permission: { action: "read", subject: "Transaction" },
    title: "Flujo de Caja",
  },
  beforeLoad: requirePermission("read", "Transaction"),
  component: () => (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <LoadingSpinner label="Cargando flujo de caja" />
        </div>
      }
    >
      <CashFlowPage />
    </Suspense>
  ),
});
