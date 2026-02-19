import { Tabs } from "@heroui/react";
import { useState } from "react";
import { ServicesAgendaContent } from "@/features/services/components/ServicesAgendaContent";
import { ServicesOverviewContent } from "@/features/services/components/ServicesOverviewContent";
import { useLazyTabs } from "@/hooks/use-lazy-tabs";

export function ServicesPage() {
  const [selectedTab, setSelectedTab] = useState<"overview" | "agenda">("overview");
  const { isTabMounted, markTabAsMounted } = useLazyTabs<"overview" | "agenda">("overview");

  return (
    <Tabs
      aria-label="Secciones de servicios"
      onSelectionChange={(key) => {
        const nextTab = String(key) as "overview" | "agenda";
        setSelectedTab(nextTab);
        markTabAsMounted(nextTab);
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
        {isTabMounted("overview") ? <ServicesOverviewContent /> : null}
      </Tabs.Panel>

      <Tabs.Panel className="space-y-8 pt-4" id="agenda">
        {isTabMounted("agenda") ? <ServicesAgendaContent /> : null}
      </Tabs.Panel>
    </Tabs>
  );
}
