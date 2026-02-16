import { Tabs } from "@heroui/react";
import { useState } from "react";
import { ServicesAgendaContent } from "@/features/services/components/ServicesAgendaContent";
import { ServicesOverviewContent } from "@/features/services/components/ServicesOverviewContent";

export function ServicesPage() {
  const [selectedTab, setSelectedTab] = useState<"overview" | "agenda">("overview");

  return (
    <Tabs
      aria-label="Secciones de servicios"
      onSelectionChange={(key) => {
        setSelectedTab(String(key) as "overview" | "agenda");
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
        <ServicesOverviewContent />
      </Tabs.Panel>

      <Tabs.Panel className="space-y-8 pt-4" id="agenda">
        <ServicesAgendaContent />
      </Tabs.Panel>
    </Tabs>
  );
}
