import { Tabs } from "@heroui/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  CalendarClock,
  Inbox,
  LayoutList,
  Library,
  Megaphone,
  Settings2,
  Webhook,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { ProtectedTab } from "@/components/auth/ProtectedTab";
import { WaCloudAlertsPage } from "@/features/wa-cloud/pages/WaCloudAlertsPage";
import { WaCloudAnalyticsPage } from "@/features/wa-cloud/pages/WaCloudAnalyticsPage";
import { WaCloudBroadcastsPage } from "@/features/wa-cloud/pages/WaCloudBroadcastsPage";
import { WaCloudCatalogPage } from "@/features/wa-cloud/pages/WaCloudCatalogPage";
import { WaCloudInboxPage } from "@/features/wa-cloud/pages/WaCloudInboxPage";
import { WaCloudScheduledPage } from "@/features/wa-cloud/pages/WaCloudScheduledPage";
import { WaCloudSettingsPage } from "@/features/wa-cloud/pages/WaCloudSettingsPage";
import { WaCloudTemplatesPage } from "@/features/wa-cloud/pages/WaCloudTemplatesPage";
import { WaCloudWebhookLogsPage } from "@/features/wa-cloud/pages/WaCloudWebhookLogsPage";
import { InboxSearchDrawer } from "@/features/wa-cloud/components/InboxSearchDrawer";
import { useLazyTabs } from "@/hooks/use-lazy-tabs";

// Unified `/wa-cloud` host (Phase 2 IA consolidation). Replaces the
// 10 separate sub-routes with a single tabbed page + a right-side
// search drawer. The old route paths still resolve as redirect-only
// shells (`<name>.tsx` files in this dir) so bookmarks keep working.
//
// URL state contract:
//   ?tab=<key>            — active tab (default "inbox"); `replace: true` on change
//   ?conversation=<id>    — inbox deep-link to a specific thread
//   ?shared=<n>           — SW `/share-target` POST marker
//   ?search=1             — opens the global-search drawer on mount
//
// All four params coexist; the redirect from `/wa-cloud/buscar` sets
// `?tab=inbox&search=1` and the inbox still honors `?conversation`.
const tabKey = z.enum([
  "inbox",
  "plantillas",
  "programados",
  "broadcasts",
  "catalogo",
  "alertas",
  "webhooks",
  "analytics",
  "configuracion",
]);
type WaCloudTab = z.infer<typeof tabKey>;

const searchSchema = z.object({
  tab: tabKey.optional().default("inbox"),
  conversation: z.coerce.number().int().positive().optional(),
  shared: z.coerce.number().int().optional(),
  // 1 → opens search drawer on mount (used by the `/wa-cloud/buscar`
  // redirect shell). Validated as a number to coerce `?search=1`.
  search: z.coerce.number().int().optional(),
});

export const Route = createFileRoute("/_authed/wa-cloud/")({
  validateSearch: searchSchema,
  staticData: {
    nav: {
      iconKey: "MessageSquare",
      label: "WhatsApp",
      order: 10,
      section: "Comunicaciones",
    },
    permission: { action: "read", subject: "WaBusinessAccount" },
    title: "WhatsApp Cloud",
  },
  beforeLoad: ({ context }) => {
    // Outer route enforces the LOOSEST permission across all tabs
    // (read WaBusinessAccount). Tab-specific RBAC (e.g. update for
    // Configuración) is enforced per-panel via <ProtectedTab>.
    if (!context.can("read", "WaBusinessAccount")) {
      throw redirect({ to: "/" });
    }
  },
  component: WaCloudPage,
});

function WaCloudPage() {
  const { tab, search } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { isTabMounted, markTabAsMounted } = useLazyTabs<WaCloudTab>(tab);

  const [drawerOpen, setDrawerOpen] = useState<boolean>(search === 1);

  // Strip ?search=1 from the URL after we open the drawer so a refresh
  // doesn't keep re-opening it; the local state is now the source of
  // truth.
  useEffect(() => {
    if (search === 1) {
      void navigate({
        search: (prev) => ({ ...prev, search: undefined }),
        replace: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

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

  // Global cmd/ctrl+K to open the search drawer. Ignored while the
  // user is typing in an input/textarea so it doesn't hijack composer
  // typing inside the inbox.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      const t = e.target as HTMLElement | null;
      const inEditable =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable);
      if (inEditable) return;
      e.preventDefault();
      setDrawerOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onSelectSearchResult = useCallback(
    (conversationId: number) => {
      void navigate({
        search: (prev) => ({ ...prev, tab: "inbox", conversation: conversationId }),
        replace: true,
      });
    },
    [navigate]
  );

  return (
    <div className="space-y-3 p-4">
      <Tabs aria-label="WhatsApp Cloud" selectedKey={tab} onSelectionChange={onTabChange}>
        <Tabs.ListContainer>
          <Tabs.List
            aria-label="Secciones"
            className="rounded-2xl border border-default-200/60 bg-background/70 p-1"
          >
            <Tabs.Tab id="inbox">
              <Inbox size={14} /> Bandeja
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="plantillas">
              <LayoutList size={14} /> Plantillas
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="programados">
              <CalendarClock size={14} /> Programados
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="broadcasts">
              <Megaphone size={14} /> Campañas
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="catalogo">
              <Library size={14} /> Catálogo
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="alertas">
              <Bell size={14} /> Alertas
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="webhooks">
              <Webhook size={14} /> Webhooks
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="analytics">
              <BarChart3 size={14} /> Analíticas
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="configuracion">
              <Settings2 size={14} /> Configuración
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="inbox" className="pt-2">
          {isTabMounted("inbox") ? (
            <ProtectedTab action="read" subject="WaBusinessAccount">
              <WaCloudInboxPage onOpenSearchDrawer={() => setDrawerOpen(true)} />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="plantillas" className="pt-4">
          {isTabMounted("plantillas") ? (
            <ProtectedTab action="read" subject="WaBusinessAccount">
              <WaCloudTemplatesPage />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="programados" className="pt-4">
          {isTabMounted("programados") ? (
            <ProtectedTab action="read" subject="WaBusinessAccount">
              <WaCloudScheduledPage />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="broadcasts" className="pt-4">
          {isTabMounted("broadcasts") ? (
            <ProtectedTab action="create" subject="WaBusinessAccount">
              <WaCloudBroadcastsPage />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="catalogo" className="pt-4">
          {isTabMounted("catalogo") ? (
            <ProtectedTab action="create" subject="WaBusinessAccount">
              <WaCloudCatalogPage />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="alertas" className="pt-4">
          {isTabMounted("alertas") ? (
            <ProtectedTab action="read" subject="WaBusinessAccount">
              <WaCloudAlertsPage />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="webhooks" className="pt-4">
          {isTabMounted("webhooks") ? (
            <ProtectedTab action="read" subject="WaBusinessAccount">
              <WaCloudWebhookLogsPage />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="analytics" className="pt-4">
          {isTabMounted("analytics") ? (
            <ProtectedTab action="read" subject="WaBusinessAccount">
              <WaCloudAnalyticsPage />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="configuracion" className="pt-4">
          {isTabMounted("configuracion") ? (
            <ProtectedTab action="update" subject="WaBusinessAccount">
              <WaCloudSettingsPage />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
      </Tabs>

      <InboxSearchDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSelectConversation={onSelectSearchResult}
      />
    </div>
  );
}
