import { Spinner, Tabs } from "@heroui/react";
import { lazy, startTransition, Suspense, useState } from "react";
import { useLazyTabs } from "@/hooks/use-lazy-tabs";

const ServicesOverviewContent = lazy(() =>
  import("@/features/services/components/ServicesOverviewContent").then((module) => ({
    default: module.ServicesOverviewContent,
  }))
);

const ServicesAgendaContent = lazy(() =>
  import("@/features/services/components/ServicesAgendaContent").then((module) => ({
    default: module.ServicesAgendaContent,
  }))
);

export function ServicesPage() {
  const [selectedTab, setSelectedTab] = useState<"overview" | "agenda">("overview");
  const { isTabMounted, markTabAsMounted } = useLazyTabs<"overview" | "agenda">("overview");

  return (
    <Tabs
      aria-label="Secciones de servicios"
      onSelectionChange={(key) => {
        const nextTab = String(key) as "overview" | "agenda";
        startTransition(() => {
          setSelectedTab(nextTab);
          markTabAsMounted(nextTab);
        });
      }}
      selectedKey={selectedTab}
    >
      <Tabs.ListContainer>
        <Tabs.List
          aria-label="Secciones"
          className="rounded-2xl border border-default-200/60 bg-background/70 p-1"
        >
          <Tabs.Tab id="overview">
            Servicios
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="agenda">
            Agenda
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>

      <Tabs.Panel className="space-y-4 pt-4" id="overview">
        {isTabMounted("overview") ? (
          <Suspense
            fallback={
              <div className="flex items-center gap-2 py-4 text-default-500 text-sm">
                <Spinner size="sm" />
                <span>Cargando...</span>
              </div>
            }
          >
            <ServicesOverviewContent />
          </Suspense>
        ) : null}
      </Tabs.Panel>

      <Tabs.Panel className="space-y-8 pt-4" id="agenda">
        {isTabMounted("agenda") ? (
          <Suspense
            fallback={
              <div className="flex items-center gap-2 py-4 text-default-500 text-sm">
                <Spinner size="sm" />
                <span>Cargando...</span>
              </div>
            }
          >
            <ServicesAgendaContent />
          </Suspense>
        ) : null}
      </Tabs.Panel>
    </Tabs>
  );
}
