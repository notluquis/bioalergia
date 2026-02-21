import { Tabs } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { dteAnalyticsKeys } from "@/features/finance/dte-analytics/queries";
import { extractYearsFromSummary, safeYearSelection } from "@/features/finance/dte-analytics/utils";
import { useLazyTabs } from "@/hooks/use-lazy-tabs";

const LazyDteMonthlySummaryPanel = lazy(() =>
  import("@/features/finance/dte-analytics/components/DteMonthlySummaryPanel").then((module) => ({
    default: module.DteMonthlySummaryPanel,
  })),
);

const LazyDteComparisonPanel = lazy(() =>
  import("@/features/finance/dte-analytics/components/DteComparisonPanel").then((module) => ({
    default: module.DteComparisonPanel,
  })),
);

export function DTEAnalyticsPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedTab, setSelectedTab] = useState<
    "purchases-comparison" | "purchases-monthly" | "sales-comparison" | "sales-monthly"
  >("purchases-monthly");
  const { isTabMounted, markTabAsMounted } = useLazyTabs<
    "purchases-comparison" | "purchases-monthly" | "sales-comparison" | "sales-monthly"
  >("purchases-monthly");

  // Load all purchases and sales data to extract years with actual data
  const { data: allPurchases } = useSuspenseQuery(dteAnalyticsKeys.purchases());
  const { data: allSales } = useSuspenseQuery(dteAnalyticsKeys.sales());

  // Extract years from data and combine
  const yearOptions = useMemo(() => {
    const purchaseYears = extractYearsFromSummary(allPurchases);
    const salesYears = extractYearsFromSummary(allSales);
    // Combine and deduplicate
    const allYears = new Set([...purchaseYears, ...salesYears]);
    return Array.from(allYears).sort().reverse();
  }, [allPurchases, allSales]);

  // Ensure selected year is always valid
  const validatedYear = useMemo(
    () => safeYearSelection(selectedYear, yearOptions),
    [selectedYear, yearOptions],
  );

  return (
    <div className="container mx-auto space-y-6 p-6">
      <Tabs
        aria-label="DTE Analytics Tabs"
        selectedKey={selectedTab}
        onSelectionChange={(key) => {
          const nextTab = String(key) as
            | "purchases-comparison"
            | "purchases-monthly"
            | "sales-comparison"
            | "sales-monthly";
          setSelectedTab(nextTab);
          markTabAsMounted(nextTab);
        }}
      >
        <Tabs.List
          aria-label="Opciones de visualización"
          className="rounded-lg bg-default-50/50 p-1"
        >
          <Tabs.Tab id="purchases-monthly" className="gap-2">
            <BarChart3 className="size-4" />
            Compras Mensual
          </Tabs.Tab>
          <Tabs.Separator />
          <Tabs.Tab id="sales-monthly" className="gap-2">
            <BarChart3 className="size-4" />
            Ventas Mensual
          </Tabs.Tab>
          <Tabs.Separator />
          <Tabs.Tab id="purchases-comparison" className="gap-2">
            <TrendingUp className="size-4" />
            Compras Comparativa
          </Tabs.Tab>
          <Tabs.Separator />
          <Tabs.Tab id="sales-comparison" className="gap-2">
            <TrendingUp className="size-4" />
            Ventas Comparativa
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel id="purchases-monthly">
          {isTabMounted("purchases-monthly") ? (
            <Suspense fallback={<div className="py-2 text-default-500 text-sm">Cargando...</div>}>
              <LazyDteMonthlySummaryPanel
                kind="purchases"
                selectedYear={validatedYear}
                setSelectedYear={setSelectedYear}
                yearOptions={yearOptions}
              />
            </Suspense>
          ) : null}
        </Tabs.Panel>

        <Tabs.Panel id="sales-monthly">
          {isTabMounted("sales-monthly") ? (
            <Suspense fallback={<div className="py-2 text-default-500 text-sm">Cargando...</div>}>
              <LazyDteMonthlySummaryPanel
                kind="sales"
                selectedYear={validatedYear}
                setSelectedYear={setSelectedYear}
                yearOptions={yearOptions}
              />
            </Suspense>
          ) : null}
        </Tabs.Panel>

        <Tabs.Panel id="purchases-comparison">
          {isTabMounted("purchases-comparison") ? (
            <Suspense fallback={<div className="py-2 text-default-500 text-sm">Cargando...</div>}>
              <LazyDteComparisonPanel kind="purchases" />
            </Suspense>
          ) : null}
        </Tabs.Panel>

        <Tabs.Panel id="sales-comparison">
          {isTabMounted("sales-comparison") ? (
            <Suspense fallback={<div className="py-2 text-default-500 text-sm">Cargando...</div>}>
              <LazyDteComparisonPanel kind="sales" />
            </Suspense>
          ) : null}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
