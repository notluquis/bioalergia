import { Tabs } from "@heroui/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ShieldCheck, Users } from "lucide-react";
import { useCallback } from "react";
import { z } from "zod";

import { ProtectedTab } from "@/components/auth/ProtectedTab";
import { RolesPanel } from "@/features/roles/pages/RolesPanel";
import { UsersPanel } from "@/features/users/pages/UsersPanel";
import { useLazyTabs } from "@/hooks/use-lazy-tabs";

/**
 * Unified `/admin/users` host (Phase 4b IA consolidation). Two tabs:
 *
 *   - usuarios (default) — was /settings/users
 *   - roles              — was /settings/roles
 *
 * Outer route requires the loosest permission across all tabs
 * (`read User`). Per-tab RBAC is enforced inside via `<ProtectedTab>`.
 */
const tabKey = z.enum(["usuarios", "roles"]);
type UsersTab = z.infer<typeof tabKey>;

const searchSchema = z.object({
  tab: tabKey.optional().default("usuarios"),
});

export const Route = createFileRoute("/_authed/admin/users")({
  staticData: {
    nav: {
      iconKey: "Users",
      label: "Usuarios",
      order: 70,
      section: "Sistema",
    },
    permission: { action: "read", subject: "User" },
    relatedSubjects: ["Role", "Permission"],
    title: "Usuarios y roles",
  },
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    if (!context.can("read", "User") && !context.can("read", "Role")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/" });
    }
  },
  component: UsersHostPage,
});

function UsersHostPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { isTabMounted, markTabAsMounted } = useLazyTabs<UsersTab>(tab);

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
      <Tabs aria-label="Usuarios" selectedKey={tab} onSelectionChange={onTabChange}>
        <Tabs.ListContainer>
          <Tabs.List
            aria-label="Secciones"
            className="rounded-2xl border border-default-200/60 bg-background/70 p-1"
          >
            <Tabs.Tab id="usuarios">
              <Users size={14} /> Usuarios
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="roles">
              <ShieldCheck size={14} /> Roles
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="usuarios" className="pt-2">
          {isTabMounted("usuarios") ? (
            <ProtectedTab action="read" subject="User">
              <UsersPanel />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="roles" className="pt-2">
          {/* Granular RBAC: the permission seed grants concrete CRUD actions
              (create/read/update/delete Role), never the CASL `manage`
              wildcard. can("manage","Role") is false unless a literal `manage`
              rule exists, so it locked out SystemAdministrator despite holding
              every Role permission. Gate on `update Role` — the write action
              that makes this an admin-only tab, consistent with the granular
              model and the `read User` sibling tab above. */}
          {isTabMounted("roles") ? (
            <ProtectedTab action="update" subject="Role">
              <RolesPanel />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
