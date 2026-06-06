import { Card, Tabs } from "@heroui/react";
import { BarChart3, ClipboardList } from "lucide-react";
import { useState } from "react";
import { ClinicalRecordsAnalyticsPanel } from "./ClinicalRecordsAnalyticsPanel";
import { ClinicalRecordsReviewPage } from "./ClinicalRecordsReviewPage";

type Tab = "review" | "analytics";

export function ClinicalRecordsWorkspacePage() {
  const [tab, setTab] = useState<Tab>("review");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <Card className="border-default-200 shadow-sm">
        <Card.Content className="p-3">
          <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(key as Tab)}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Secciones fichas clínicas">
                <Tabs.Tab id="review">
                  <ClipboardList size={16} />
                  Revisión
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

      {tab === "review" ? <ClinicalRecordsReviewPage /> : <ClinicalRecordsAnalyticsPanel />}
    </div>
  );
}
