import { Tabs } from "@heroui/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Building2, FileText, ListChecks } from "lucide-react";
import { useCallback, useEffect } from "react";
import { z } from "zod";

import { ProtectedTab } from "@/components/auth/ProtectedTab";
import { useToast } from "@/context/ToastContext";
import { ClinicSettingsPanel } from "@/features/exam-reports/pages/ClinicSettingsPanel";
import { ConclusionTemplatesPanel } from "@/features/exam-reports/pages/ConclusionTemplatesPanel";
import { ExamReportsListPanel } from "@/features/exam-reports/pages/ExamReportsListPanel";
import { useLazyTabs } from "@/hooks/use-lazy-tabs";

/**
 * Unified `/exam-reports` host (Phase 3 IA consolidation). Three tabs:
 *
 *   - lista        — informes list (default)
 *   - plantillas   — conclusion templates (was /settings/conclusion-templates)
 *   - clinica      — clinic profile + signature (was /settings/clinic)
 *
 * URL state contract:
 *   ?tab=<key>    — active tab (default "lista"); `replace: true` on change
 *   ?notFound=1   — surfaced once by the /$id loader; toasted then stripped
 *
 * The `/exam-reports/$id` edit route stays separate. The two settings
 * routes are now redirect-only shells that land on the right tab here.
 */
const tabKey = z.enum(["lista", "plantillas", "clinica"]);
type ExamReportsTab = z.infer<typeof tabKey>;

const searchSchema = z.object({
  tab: tabKey.optional().default("lista"),
  notFound: z.coerce.number().optional(),
});

export const Route = createFileRoute("/_authed/exam-reports/")({
  staticData: {
    nav: {
      iconKey: "FileText",
      label: "Informes",
      order: 30,
      section: "Clínica",
    },
    permission: { action: "read", subject: "ExamReport" },
    title: "Informes",
  },
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    // Outer route enforces the LOOSEST permission across all tabs
    // (read ExamReport). Tab-specific RBAC (update ConclusionTemplate /
    // update ClinicSettings) is enforced per-panel via <ProtectedTab>.
    if (!context.can("read", "ExamReport")) {
      throw redirect({ to: "/" });
    }
  },
  component: ExamReportsHostPage,
});

function ExamReportsHostPage() {
  const { tab, notFound } = Route.useSearch();
  const navigate = Route.useNavigate();
  const toast = useToast();
  const { isTabMounted, markTabAsMounted } = useLazyTabs<ExamReportsTab>(tab);

  // Surface 404 from /$id loader once, then strip the search param so a
  // page refresh doesn't re-toast. Preserved from the original list page.
  useEffect(() => {
    if (notFound) {
      toast.error("Informe no encontrado");
      void navigate({
        search: (prev) => ({ ...prev, notFound: undefined }),
        replace: true,
      });
    }
  }, [notFound, toast, navigate]);

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
      <Tabs aria-label="Informes" selectedKey={tab} onSelectionChange={onTabChange}>
        <Tabs.ListContainer>
          <Tabs.List
            aria-label="Secciones"
            className="rounded-2xl border border-default-200/60 bg-background/70 p-1"
          >
            <Tabs.Tab id="lista">
              <ListChecks size={14} /> Lista
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="plantillas">
              <FileText size={14} /> Plantillas
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="clinica">
              <Building2 size={14} /> Clínica
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="lista" className="pt-2">
          {isTabMounted("lista") ? (
            <ProtectedTab action="read" subject="ExamReport">
              <ExamReportsListPanel />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="plantillas" className="pt-4">
          {isTabMounted("plantillas") ? (
            <ProtectedTab action="update" subject="ConclusionTemplate">
              <ConclusionTemplatesPanel />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="clinica" className="pt-4">
          {isTabMounted("clinica") ? (
            <ProtectedTab action="update" subject="ClinicSettings">
              <ClinicSettingsPanel />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
