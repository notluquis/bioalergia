import { Tabs } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { BarChart3, TrendingUp } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
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

const LazyDteSalesDetailsPanel = lazy(() =>
  import("@/features/finance/dte-analytics/components/DteSalesDetailsPanel").then((module) => ({
    default: module.DteSalesDetailsPanel,
  })),
);

const LazyDtePurchasesDetailsPanel = lazy(() =>
  import("@/features/finance/dte-analytics/components/DtePurchasesDetailsPanel").then((module) => ({
    default: module.DtePurchasesDetailsPanel,
  })),
);

const LazyCalendarDteLinksOverview = lazy(() =>
  import("@/features/calendar/components/CalendarDteLinksOverview").then((module) => ({
    default: module.CalendarDteLinksOverview,
  })),
);

const routeApi = getRouteApi("/_authed/finanzas/dte-analytics");

export function DTEAnalyticsPage() {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const selectedTab = (search.tab ?? "purchases-monthly") as
    | "purchases-comparison"
    | "event-links"
    | "purchases-details"
    | "purchases-monthly"
    | "sales-comparison"
    | "sales-details"
    | "sales-monthly";
  const { isTabMounted, markTabAsMounted } = useLazyTabs<
    | "purchases-comparison"
    | "event-links"
    | "purchases-details"
    | "purchases-monthly"
    | "sales-comparison"
    | "sales-details"
    | "sales-monthly"
  >(selectedTab);

  useEffect(() => {
    markTabAsMounted(selectedTab);
  }, [markTabAsMounted, selectedTab]);

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
    <div className="flex h-full min-h-full w-full flex-col gap-4 p-3 md:p-5">
      <Tabs
        aria-label="DTE Analytics Tabs"
        className="flex min-h-0 flex-1 flex-col"
        selectedKey={selectedTab}
        onSelectionChange={(key) => {
          const nextTab = String(key) as
            | "purchases-comparison"
            | "event-links"
            | "purchases-monthly"
            | "sales-comparison"
            | "sales-monthly";
          void navigate({
            search: (prev) => ({
              ...prev,
              tab: nextTab,
            }),
          });
        }}
      >
        <Tabs.ListContainer className="muted-scrollbar overflow-x-auto pb-1">
          <Tabs.List
            aria-label="Opciones de visualización"
            className="w-max min-w-full rounded-lg bg-default-50/50 p-1 whitespace-nowrap"
          >
            <Tabs.Tab id="purchases-monthly" className="gap-2">
              <BarChart3 className="size-4" />
              Compras Mensual
            </Tabs.Tab>
            <Tabs.Tab id="sales-monthly" className="gap-2">
              <BarChart3 className="size-4" />
              Ventas Mensual
            </Tabs.Tab>
            <Tabs.Tab id="purchases-details" className="gap-2">
              <BarChart3 className="size-4" />
              Compras Detalle
            </Tabs.Tab>
            <Tabs.Tab id="sales-details" className="gap-2">
              <BarChart3 className="size-4" />
              Ventas Detalle
            </Tabs.Tab>
            <Tabs.Tab id="purchases-comparison" className="gap-2">
              <TrendingUp className="size-4" />
              Compras Comparativa
            </Tabs.Tab>
            <Tabs.Tab id="sales-comparison" className="gap-2">
              <TrendingUp className="size-4" />
              Ventas Comparativa
            </Tabs.Tab>
            <Tabs.Tab id="event-links" className="gap-2">
              <TrendingUp className="size-4" />
              Vínculos DTE
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel className="min-h-0 flex-1 pt-2 sm:pt-4" id="purchases-monthly">
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

        <Tabs.Panel className="min-h-0 flex-1 pt-2 sm:pt-4" id="sales-monthly">
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

        <Tabs.Panel className="min-h-0 flex-1 pt-2 sm:pt-4" id="purchases-comparison">
          {isTabMounted("purchases-comparison") ? (
            <Suspense fallback={<div className="py-2 text-default-500 text-sm">Cargando...</div>}>
              <LazyDteComparisonPanel kind="purchases" />
            </Suspense>
          ) : null}
        </Tabs.Panel>

        <Tabs.Panel className="min-h-0 flex-1 pt-2 sm:pt-4" id="purchases-details">
          {isTabMounted("purchases-details") ? (
            <Suspense fallback={<div className="py-2 text-default-500 text-sm">Cargando...</div>}>
              <LazyDtePurchasesDetailsPanel />
            </Suspense>
          ) : null}
        </Tabs.Panel>

        <Tabs.Panel className="min-h-0 flex-1 pt-2 sm:pt-4" id="sales-details">
          {isTabMounted("sales-details") ? (
            <Suspense fallback={<div className="py-2 text-default-500 text-sm">Cargando...</div>}>
              <LazyDteSalesDetailsPanel />
            </Suspense>
          ) : null}
        </Tabs.Panel>

        <Tabs.Panel className="min-h-0 flex-1 pt-2 sm:pt-4" id="sales-comparison">
          {isTabMounted("sales-comparison") ? (
            <Suspense fallback={<div className="py-2 text-default-500 text-sm">Cargando...</div>}>
              <LazyDteComparisonPanel kind="sales" />
            </Suspense>
          ) : null}
        </Tabs.Panel>

        <Tabs.Panel className="min-h-0 flex-1 pt-2 sm:pt-4" id="event-links">
          {isTabMounted("event-links") ? (
            <Suspense fallback={<div className="py-2 text-default-500 text-sm">Cargando...</div>}>
              <LazyCalendarDteLinksOverview
                search={{
                  page: search.page ?? 0,
                  pageSize: search.pageSize ?? 25,
                  period: search.period ?? new Date().toISOString().slice(0, 7),
                  query: search.query,
                  status: search.status ?? "all",
                }}
                onSearchChange={(next) => {
                  void navigate({
                    search: (prev) => ({
                      ...prev,
                      ...next,
                      tab: "event-links",
                    }),
                  });
                }}
              />
            </Suspense>
          ) : null}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
