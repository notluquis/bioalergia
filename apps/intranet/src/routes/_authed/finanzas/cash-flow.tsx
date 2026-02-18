import { Spinner } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

// Lazy load the page
const CashFlowPage = lazy(() =>
  import("../../../features/finance/pages/CashFlowPage").then((mod) => ({
    default: mod.CashFlowPage,
  })),
);

export const Route = createFileRoute("/_authed/finanzas/cash-flow")({
  staticData: {
    nav: { iconKey: "Banknote", label: "Flujo de Caja", order: 1, section: "Finanzas" },
    title: "Flujo de Caja",
  },
  component: () => (
    <Suspense
      fallback={
        <div className="flex justify-center p-10">
          <Spinner />
        </div>
      }
    >
      <CashFlowPage />
    </Suspense>
  ),
});
