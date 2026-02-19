import { Skeleton } from "@heroui/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
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
    permission: { action: "read", subject: "Transaction" },
    title: "Flujo de Caja",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Transaction")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense
      fallback={
        <div className="space-y-3 p-4">
          <Skeleton className="h-10 w-56 rounded-lg" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      }
    >
      <CashFlowPage />
    </Suspense>
  ),
});
