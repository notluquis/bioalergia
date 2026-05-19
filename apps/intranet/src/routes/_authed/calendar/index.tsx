import { Tabs } from "@heroui/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Clock, LayoutGrid } from "lucide-react";
import { useCallback } from "react";
import { z } from "zod";

import { ProtectedTab } from "@/components/auth/ProtectedTab";
import { CalendarSyncHistoryPanel } from "@/features/calendar/pages/CalendarSyncHistoryPanel";
import { CalendarVistaPanel } from "@/features/calendar/pages/CalendarVistaPanel";
import { calendarSyncQueries } from "@/features/calendar/queries";
import { useLazyTabs } from "@/hooks/use-lazy-tabs";

/**
 * Unified `/calendar` host (Phase 5 IA consolidation). Two tabs:
 *
 *   - vista       — landing surface linking to /clinical agenda/day/heatmap
 *                   (default)
 *   - historial   — sync history + manual sync (was /calendar/sync-history)
 *
 * URL state contract:
 *   ?tab=<key>    — active tab (default "vista"); `replace: true` on change
 *
 * Tab-specific RBAC enforced per-panel via `<ProtectedTab>`. The outer
 * `beforeLoad` only enforces the LOOSEST permission (`read Calendar`)
 * so deep-links stay valid for read-only operators.
 */
const tabKey = z.enum(["vista", "historial"]);
type CalendarTab = z.infer<typeof tabKey>;

const searchSchema = z.object({
  tab: tabKey.optional().default("vista"),
});

export const Route = createFileRoute("/_authed/calendar/")({
  staticData: {
    nav: { iconKey: "Calendar", label: "Calendario", order: 15, section: "Clínica" },
    permission: { action: "read", subject: "Calendar" },
    relatedSubjects: [
      "CalendarSyncLog",
      "CalendarSetting",
      "CalendarWatchChannel",
      "SyncLog",
      "DoctoraliaSyncLog",
      "DoctoraliaSchedule",
      "DoctoraliaCalendarAppointment",
      "DoctoraliaWorkPeriod",
    ],
    title: "Calendario",
  },
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Calendar")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/" });
    }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(calendarSyncQueries.logs(50)),
  component: CalendarHostPage,
});

function CalendarHostPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { isTabMounted, markTabAsMounted } = useLazyTabs<CalendarTab>(tab);

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
      <Tabs aria-label="Calendario" selectedKey={tab} onSelectionChange={onTabChange}>
        <Tabs.ListContainer>
          <Tabs.List
            aria-label="Secciones"
            className="rounded-2xl border border-default-200/60 bg-background/70 p-1"
          >
            <Tabs.Tab id="vista">
              <LayoutGrid size={14} /> Vista
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="historial">
              <Clock size={14} /> Historial
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="vista" className="pt-4">
          {isTabMounted("vista") ? (
            <ProtectedTab action="read" subject="Calendar">
              <CalendarVistaPanel />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="historial" className="pt-4">
          {isTabMounted("historial") ? (
            <ProtectedTab action="read" subject="CalendarSyncLog">
              <CalendarSyncHistoryPanel />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
