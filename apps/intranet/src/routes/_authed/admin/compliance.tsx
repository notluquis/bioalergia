import { Tabs } from "@heroui/react";
import { PAGE_CONTAINER } from "@/lib/styles";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  ClipboardCheck,
  ClipboardList,
  Database,
  Fingerprint,
  LayoutDashboard,
  ListChecks,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useCallback } from "react";
import { z } from "zod";

import { ProtectedTab } from "@/components/auth/ProtectedTab";
import { BreachIncidentsPage } from "@/features/breach-incidents/pages/BreachIncidentsPage";
import { ClinicalConsentPage } from "@/features/clinical-consent/pages/ClinicalConsentPage";
import { ComplaintsPage } from "@/features/complaints/pages/ComplaintsPage";
import { ConsentPage } from "@/features/consent/pages/ConsentPage";
import { DataRightsPage } from "@/features/data-rights/pages/DataRightsPage";
import { KarinPage } from "@/features/karin/pages/KarinPage";
import { ProcessingActivitiesPage } from "@/features/processing-activities/pages/ProcessingActivitiesPage";
import { RetentionPoliciesPage } from "@/features/settings/pages/RetentionPoliciesPage";
import { SecurityAlertsPage } from "@/features/settings/pages/SecurityAlertsPage";
import { useLazyTabs } from "@/hooks/use-lazy-tabs";

/**
 * Unified `/admin/compliance` host (Wave 3 IA consolidation). Eight tabs,
 * all previously standalone nav items under "Sistema":
 *
 *   - consentimientos        (default) — was /settings/consent
 *   - consentimiento-clinico            — was /settings/clinical-consent
 *   - derechos                          — was /settings/data-rights
 *   - rat                               — was /settings/processing-activities
 *   - brechas                           — was /settings/breach-incidents
 *   - reclamos                          — was /settings/complaints
 *   - retencion                         — was /settings/retention
 *   - alertas                           — was /settings/security-alerts
 *
 * URL contract: `?tab=<key>`, `replace: true` on tab change so the
 * browser history reflects pages, not tab toggles.
 *
 * Outer route requires the loosest permission across all tabs
 * (`read Setting`). Per-tab RBAC is enforced inside via `<ProtectedTab>`
 * — only `retencion` needs the stricter `update Setting`.
 */
const tabKey = z.enum([
  "consentimientos",
  "consentimiento-clinico",
  "derechos",
  "rat",
  "brechas",
  "reclamos",
  "karin",
  "retencion",
  "alertas",
]);
type ComplianceTab = z.infer<typeof tabKey>;

const searchSchema = z.object({
  tab: tabKey.optional().default("consentimientos"),
});

export const Route = createFileRoute("/_authed/admin/compliance")({
  staticData: {
    nav: {
      iconKey: "ShieldCheck",
      label: "Cumplimiento",
      order: 90,
      section: "Sistema",
    },
    permission: { action: "read", subject: "Setting" },
    relatedSubjects: ["Setting"],
    title: "Cumplimiento",
  },
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    // Loosest permission across all tabs — `read Setting`. Users without
    // it shouldn't even see the host page in the sidebar.
    if (!context.can("read", "Setting")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/" });
    }
  },
  component: ComplianceHostPage,
});

function ComplianceHostPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { isTabMounted, markTabAsMounted } = useLazyTabs<ComplianceTab>(tab);

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
    <div className={PAGE_CONTAINER}>
      <Tabs aria-label="Cumplimiento" selectedKey={tab} onSelectionChange={onTabChange}>
        <Tabs.ListContainer>
          <Tabs.List
            aria-label="Secciones"
            className="rounded-2xl border border-default-200/60 bg-background/70 p-1"
          >
            <Tabs.Tab id="consentimientos">
              <UserCheck size={14} /> Consentimientos
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="consentimiento-clinico">
              <ClipboardCheck size={14} /> Consent. clínico
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="derechos">
              <Fingerprint size={14} /> Derechos
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="rat">
              <ListChecks size={14} /> RAT
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="brechas">
              <ShieldCheck size={14} /> Brechas
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="reclamos">
              <ClipboardList size={14} /> Reclamos
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="karin">
              <ShieldAlert size={14} /> Denuncias Karin
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="retencion">
              <Database size={14} /> Retención
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="alertas">
              <LayoutDashboard size={14} /> Alertas
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="consentimientos" className="pt-2">
          {isTabMounted("consentimientos") ? <ConsentPage /> : null}
        </Tabs.Panel>
        <Tabs.Panel id="consentimiento-clinico" className="pt-2">
          {isTabMounted("consentimiento-clinico") ? <ClinicalConsentPage /> : null}
        </Tabs.Panel>
        <Tabs.Panel id="derechos" className="pt-2">
          {isTabMounted("derechos") ? <DataRightsPage /> : null}
        </Tabs.Panel>
        <Tabs.Panel id="rat" className="pt-2">
          {isTabMounted("rat") ? <ProcessingActivitiesPage /> : null}
        </Tabs.Panel>
        <Tabs.Panel id="brechas" className="pt-2">
          {isTabMounted("brechas") ? <BreachIncidentsPage /> : null}
        </Tabs.Panel>
        <Tabs.Panel id="reclamos" className="pt-2">
          {isTabMounted("reclamos") ? <ComplaintsPage /> : null}
        </Tabs.Panel>
        <Tabs.Panel id="karin" className="pt-2">
          {isTabMounted("karin") ? (
            <ProtectedTab action="read" subject="KarinReport">
              <KarinPage />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="retencion" className="pt-2">
          {isTabMounted("retencion") ? (
            <ProtectedTab action="update" subject="Setting">
              <RetentionPoliciesPage />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="alertas" className="pt-2">
          {isTabMounted("alertas") ? <SecurityAlertsPage /> : null}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
