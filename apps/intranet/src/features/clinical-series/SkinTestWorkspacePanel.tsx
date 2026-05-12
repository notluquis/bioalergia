import { Card, Tabs } from "@heroui/react";
import { BarChart3, CloudUpload } from "lucide-react";
import { useState } from "react";
import { SkinTestAnalyticsPanel } from "./SkinTestAnalyticsPanel";
import { SkinTestImportPanel } from "./SkinTestImportPanel";

type SkinTestWorkspaceTab = "imports" | "analytics";

export function SkinTestWorkspacePanel() {
  const [tab, setTab] = useState<SkinTestWorkspaceTab>("imports");

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-4">
      <Card className="border-default-200 shadow-sm">
        <Card.Content className="p-3">
          <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(key as SkinTestWorkspaceTab)}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Secciones tests cutáneos">
                <Tabs.Tab id="imports">
                  <CloudUpload size={16} />
                  Importación
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="analytics">
                  <BarChart3 size={16} />
                  Análisis
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        </Card.Content>
      </Card>

      {tab === "imports" ? <SkinTestImportPanel /> : <SkinTestAnalyticsPanel />}
    </div>
  );
}
