import { Tabs } from "@heroui/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { BarChart3, LayoutDashboard } from "lucide-react";
import { useCallback } from "react";
import { z } from "zod";

import { ProtectedTab } from "@/components/auth/ProtectedTab";
import { FinancialDashboardPage } from "@/features/finance/pages/FinancialDashboardPage";
import { FinanzasStatsPage } from "@/features/finance/statistics/pages/FinanzasStatsPage";
import { useLazyTabs } from "@/hooks/use-lazy-tabs";

/**
 * Unified `/finanzas/dashboard` host (Phase 6.3 IA consolidation):
 *
 *   - widgets (default) — FinancialDashboardPage (widget grid + KPIs)
 *   - estadisticas      — FinanzasStatsPage (analytics + breakdowns)
 *
 * Was 2 sidebar entries ("Tablero" + "Estadísticas") collapsed into 1.
 * Outer enforces `read Event` (loosest), `<ProtectedTab>` re-gates
 * `estadisticas` on `read TransactionStats`.
 */
const tabKey = z.enum(["widgets", "estadisticas"]);
type DashboardTab = z.infer<typeof tabKey>;

const searchSchema = z.object({
  tab: tabKey.optional().default("widgets"),
});

export const Route = createFileRoute("/_authed/finanzas/dashboard")({
  staticData: {
    nav: {
      iconKey: "LayoutDashboard",
      label: "Tablero",
      order: 10,
      section: "Finanzas",
    },
    permission: { action: "read", subject: "Event" },
    relatedSubjects: ["Dashboard", "TransactionStats"],
    title: "Tablero Financiero",
  },
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Event")) {
      throw redirect({ to: "/" });
    }
  },
  component: FinanzasDashboardHostPage,
});

function FinanzasDashboardHostPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { isTabMounted, markTabAsMounted } = useLazyTabs<DashboardTab>(tab);

  const onTabChange = useCallback(
    (key: unknown) => {
      const parsed = tabKey.safeParse(key);
      if (!parsed.success) return;
      const next = parsed.data;
      markTabAsMounted(next);
      void navigate({
        search: (prev) => ({ ...prev, tab: next }),
        replace: true,
      });
    },
    [navigate, markTabAsMounted]
  );

  return (
    <div className="space-y-3 p-4">
      <Tabs aria-label="Tablero" selectedKey={tab} onSelectionChange={onTabChange}>
        <Tabs.ListContainer>
          <Tabs.List
            aria-label="Secciones"
            className="rounded-2xl border border-default-200/60 bg-background/70 p-1"
          >
            <Tabs.Tab id="widgets">
              <LayoutDashboard size={14} /> Widgets
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="estadisticas">
              <BarChart3 size={14} /> Estadísticas
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="widgets" className="pt-4">
          {isTabMounted("widgets") ? (
            <ProtectedTab action="read" subject="Event">
              <FinancialDashboardPage />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="estadisticas" className="pt-4">
          {isTabMounted("estadisticas") ? (
            <ProtectedTab action="read" subject="TransactionStats">
              <FinanzasStatsPage />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
