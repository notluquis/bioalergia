import { Tabs } from "@heroui/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ClipboardList, FileBarChart, History, Timer, UserCheck } from "lucide-react";
import { useCallback } from "react";
import { z } from "zod";

import { ProtectedTab } from "@/components/auth/ProtectedTab";
import { AdminAttendancePage } from "@/features/attendance/AdminAttendancePage";
import { EmployeesPage } from "@/features/hr/employees/pages/EmployeesPage";
import { ReportsPage } from "@/features/hr/reports/pages/ReportsPage";
import { TimesheetAuditPage } from "@/features/hr/timesheets-audit/pages/TimesheetAuditPage";
import { TimesheetsPage } from "@/features/hr/timesheets/pages/TimesheetsPage";
import { useLazyTabs } from "@/hooks/use-lazy-tabs";

/**
 * Unified `/hr` host (Phase 6.2 IA consolidation). Five tabs:
 *
 *   - empleados   — staff list (default)
 *   - asistencia  — attendance admin
 *   - timesheets  — control horario
 *   - reportes    — RRHH reports
 *   - auditoria   — timesheet audit
 *
 * URL state contract:
 *   ?tab=<key>   — active tab; `replace: true` on change
 *
 * Marcar (`/marcar`) stays separate — employee-facing fingerprint
 * clock-in, NOT part of the admin RRHH host.
 *
 * Tab-specific RBAC enforced per-panel via `<ProtectedTab>`. The outer
 * `beforeLoad` enforces the LOOSEST permission (`read Employee`) so
 * read-only operators can land on the host without a redirect loop.
 */
const tabKey = z.enum(["empleados", "asistencia", "timesheets", "reportes", "auditoria"]);
type HrTab = z.infer<typeof tabKey>;

const searchSchema = z.object({
  tab: tabKey.optional().default("empleados"),
});

export const Route = createFileRoute("/_authed/hr/")({
  staticData: {
    nav: {
      iconKey: "Users",
      label: "RRHH",
      order: 10,
      section: "Personal",
    },
    permission: { action: "read", subject: "Employee" },
    relatedSubjects: ["AttendanceAdmin", "Timesheet", "Report", "TimesheetList"],
    title: "RRHH",
  },
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Employee")) {
      throw redirect({ to: "/" });
    }
  },
  component: HrHostPage,
});

function HrHostPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { isTabMounted, markTabAsMounted } = useLazyTabs<HrTab>(tab);

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
      <Tabs aria-label="RRHH" selectedKey={tab} onSelectionChange={onTabChange}>
        <Tabs.ListContainer>
          <Tabs.List
            aria-label="Secciones"
            className="rounded-2xl border border-default-200/60 bg-background/70 p-1"
          >
            <Tabs.Tab id="empleados">
              <UserCheck size={14} /> Empleados
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="asistencia">
              <ClipboardList size={14} /> Asistencia
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="timesheets">
              <Timer size={14} /> Control horario
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="reportes">
              <FileBarChart size={14} /> Reportes
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="auditoria">
              <History size={14} /> Auditoría
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="empleados" className="pt-4">
          {isTabMounted("empleados") ? (
            <ProtectedTab action="read" subject="Employee">
              <EmployeesPage />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="asistencia" className="pt-4">
          {isTabMounted("asistencia") ? (
            <ProtectedTab action="read" subject="AttendanceAdmin">
              <AdminAttendancePage />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="timesheets" className="pt-4">
          {isTabMounted("timesheets") ? (
            <ProtectedTab action="read" subject="TimesheetList">
              <TimesheetsPage />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="reportes" className="pt-4">
          {isTabMounted("reportes") ? (
            <ProtectedTab action="read" subject="Report">
              <ReportsPage />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="auditoria" className="pt-4">
          {isTabMounted("auditoria") ? (
            <ProtectedTab action="read" subject="TimesheetList">
              <TimesheetAuditPage />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
