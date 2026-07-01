import { Skeleton, Tabs } from "@heroui/react";
import { PAGE_CONTAINER } from "@/lib/styles";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Clock, Flame, LayoutGrid, Tags } from "lucide-react";
import { Suspense, useCallback } from "react";
import { z } from "zod";

import { ProtectedTab } from "@/components/auth/ProtectedTab";
import { CalendarSyncHistoryPanel } from "@/features/calendar/pages/CalendarSyncHistoryPanel";
import { CalendarVistaPanel } from "@/features/calendar/pages/CalendarVistaPanel";
import { calendarQueries, calendarSyncQueries } from "@/features/calendar/queries";
import { calendarSearchSchema } from "@/features/calendar/types";
import { buildCalendarFilters } from "@/features/calendar/utils/filters";
import { CalendarClassificationPage } from "@/pages/CalendarClassificationPage";
import { CalendarDailyPage } from "@/pages/CalendarDailyPage";
import { CalendarHeatmapPage } from "@/pages/CalendarHeatmapPage";
import { useLazyTabs } from "@/hooks/use-lazy-tabs";
import { requirePermission } from "@/lib/authz/route-guards";

/**
 * Unified `/calendar` home. One host for every calendar surface (was split
 * across `/calendar` + four `/clinical/*` pages, all reading the same data hook):
 *
 *   - vista         — unified FullCalendar agenda (default)
 *   - dia           — hour-by-hour daily detail + DTE linking
 *   - heatmap       — appointment density heatmap
 *   - clasificacion — manual event classification / series rebuild
 *   - historial     — sync history + manual sync
 *
 * URL state: `?tab=<key>` (default "vista"); the calendar filter params
 * (from/to/date/source/calendarId/category/search) live on the same URL and
 * feed the panels. Tab-specific RBAC is enforced per-panel via `<ProtectedTab>`;
 * the outer `beforeLoad` enforces only the loosest permission (`read Calendar`)
 * so read-only deep-links stay valid.
 */
const tabKey = z.enum(["vista", "dia", "heatmap", "clasificacion", "historial"]);
type CalendarTab = z.infer<typeof tabKey>;

const searchSchema = calendarSearchSchema.extend({
  tab: tabKey.optional().default("vista"),
  // Carried for the classification tab (parsed there via classifySearchSchema).
  filterMode: z.enum(["AND", "OR"]).optional().catch(undefined),
  missing: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute("/_authed/calendar/")({
  staticData: {
    nav: { iconKey: "Calendar", label: "Calendario", order: 15, section: "Clínica" },
    permission: { action: "read", subject: "Calendar" },
    relatedSubjects: [
      "CalendarSchedule",
      "CalendarDaily",
      "CalendarHeatmap",
      "CalendarEvent",
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
  beforeLoad: requirePermission("read", "Calendar"),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps: search }) => {
    await context.queryClient.ensureQueryData(calendarSyncQueries.logs(50));
    // Vista/día/heatmap all read the shared summary+daily payload. Skip for the
    // Doctoralia source (it fetches its own merged view).
    if (search.source === "doctoralia") {
      return;
    }
    const filters = buildCalendarFilters(search, {});
    await Promise.all([
      context.queryClient.ensureQueryData(calendarQueries.summary(filters)),
      context.queryClient.ensureQueryData(calendarQueries.daily(filters)),
    ]);
  },
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
      void navigate({ search: (prev) => ({ ...prev, tab: next }), replace: true });
    },
    [navigate, markTabAsMounted]
  );

  return (
    <div className={PAGE_CONTAINER}>
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
            <Tabs.Tab id="dia">
              <CalendarDays size={14} /> Día
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="heatmap">
              <Flame size={14} /> Mapa de calor
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="clasificacion">
              <Tags size={14} /> Clasificación
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
        <Tabs.Panel id="dia" className="pt-4">
          {isTabMounted("dia") ? (
            <ProtectedTab action="read" subject="CalendarDaily">
              <CalendarDailyPage />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="heatmap" className="pt-4">
          {isTabMounted("heatmap") ? (
            <ProtectedTab action="read" subject="CalendarHeatmap">
              <CalendarHeatmapPage />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="clasificacion" className="pt-4">
          {isTabMounted("clasificacion") ? (
            <ProtectedTab action="update" subject="CalendarEvent">
              <Suspense
                fallback={
                  <Skeleton
                    aria-label="Cargando clasificación"
                    className="h-96 w-full rounded-xl"
                  />
                }
              >
                <CalendarClassificationPage />
              </Suspense>
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
