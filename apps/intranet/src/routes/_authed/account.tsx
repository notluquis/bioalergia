import { Tabs } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, Lock, UserRound } from "lucide-react";
import { useCallback } from "react";
import { z } from "zod";

import { NotificationsPanel } from "@/features/notifications/pages/NotificationsPanel";
import { ProfilePanel } from "@/features/account/pages/ProfilePanel";
import { SecurityPanel } from "@/features/account/pages/SecurityPanel";
import { useLazyTabs } from "@/hooks/use-lazy-tabs";

/**
 * `/account` host (Phase 4b IA consolidation). Three tabs:
 *
 *   - perfil (default)   — read-only identity from the auth session
 *   - seguridad          — passkeys + MFA (was AccountSettingsPage body)
 *   - notificaciones     — push privacy + lock-screen preview
 *                          (was /settings/notifications, now a per-user
 *                          preference)
 *
 * Access is `_authed` only — every authenticated user can manage their
 * own account. No admin permission required on the outer route.
 */
const tabKey = z.enum(["perfil", "seguridad", "notificaciones"]);
type AccountTab = z.infer<typeof tabKey>;

const searchSchema = z.object({
  tab: tabKey.optional().default("perfil"),
});

export const Route = createFileRoute("/_authed/account")({
  staticData: {
    title: "Mi cuenta",
  },
  validateSearch: searchSchema,
  component: AccountHostPage,
});

function AccountHostPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { isTabMounted, markTabAsMounted } = useLazyTabs<AccountTab>(tab);

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
      <Tabs aria-label="Mi cuenta" selectedKey={tab} onSelectionChange={onTabChange}>
        <Tabs.ListContainer>
          <Tabs.List
            aria-label="Secciones"
            className="rounded-2xl border border-default-200/60 bg-background/70 p-1"
          >
            <Tabs.Tab id="perfil">
              <UserRound size={14} /> Perfil
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="seguridad">
              <Lock size={14} /> Seguridad
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="notificaciones">
              <Bell size={14} /> Notificaciones
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="perfil" className="pt-2">
          {isTabMounted("perfil") ? <ProfilePanel /> : null}
        </Tabs.Panel>
        <Tabs.Panel id="seguridad" className="pt-2">
          {isTabMounted("seguridad") ? <SecurityPanel /> : null}
        </Tabs.Panel>
        <Tabs.Panel id="notificaciones" className="pt-2">
          {isTabMounted("notificaciones") ? <NotificationsPanel /> : null}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
