import { Tabs } from "@heroui/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { HardDrive, Upload } from "lucide-react";
import { useCallback } from "react";
import { z } from "zod";

import { ProtectedTab } from "@/components/auth/ProtectedTab";
import { BackupPanel } from "@/features/backup/pages/BackupPanel";
import { CSVUploadPanel } from "@/features/data-import/pages/CSVUploadPanel";
import { useLazyTabs } from "@/hooks/use-lazy-tabs";

/**
 * Unified `/admin/database` host (Phase 4b IA consolidation). Two tabs:
 *
 *   - importar (default) — was /settings/csv-upload
 *   - backups            — was /settings/backups
 *
 * URL contract: `?tab=<key>`, `replace: true` on tab change so the
 * browser history reflects pages, not tab toggles.
 *
 * Outer route requires the loosest permission across all tabs
 * (`read Backup`). Per-tab RBAC is enforced inside via `<ProtectedTab>`.
 */
const tabKey = z.enum(["importar", "backups"]);
type DatabaseTab = z.infer<typeof tabKey>;

const searchSchema = z.object({
  tab: tabKey.optional().default("importar"),
});

export const Route = createFileRoute("/_authed/admin/database")({
  staticData: {
    nav: {
      iconKey: "Database",
      label: "Base de datos",
      order: 80,
      section: "Sistema",
    },
    permission: { action: "read", subject: "Backup" },
    relatedSubjects: ["BulkData", "DebugToken", "Setting"],
    title: "Base de datos",
  },
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    // Loosest permission across all tabs — `read Backup`. Users without
    // it shouldn't even see the host page in the sidebar.
    if (!context.can("read", "Backup") && !context.can("create", "BulkData")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/" });
    }
  },
  component: DatabaseHostPage,
});

function DatabaseHostPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { isTabMounted, markTabAsMounted } = useLazyTabs<DatabaseTab>(tab);

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
      <Tabs aria-label="Base de datos" selectedKey={tab} onSelectionChange={onTabChange}>
        <Tabs.ListContainer>
          <Tabs.List
            aria-label="Secciones"
            className="rounded-2xl border border-default-200/60 bg-background/70 p-1"
          >
            <Tabs.Tab id="importar">
              <Upload size={14} /> Importar
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="backups">
              <HardDrive size={14} /> Backups
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="importar" className="pt-2">
          {isTabMounted("importar") ? (
            <ProtectedTab action="create" subject="BulkData">
              <CSVUploadPanel />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="backups" className="pt-2">
          {isTabMounted("backups") ? (
            <ProtectedTab action="read" subject="Backup">
              <BackupPanel />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
