import { Tabs } from "@heroui/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Bot, School, SearchCode } from "lucide-react";
import { useCallback } from "react";
import { z } from "zod";

import { ProtectedTab } from "@/components/auth/ProtectedTab";
import { DirectorioCrawlerPanel } from "@/features/outreach/pages/DirectorioCrawlerPanel";
import { DirectorioDescubrirPanel } from "@/features/outreach/pages/DirectorioDescubrirPanel";
import { DirectorioEstablecimientosPanel } from "@/features/outreach/pages/DirectorioEstablecimientosPanel";
import { useLazyTabs } from "@/hooks/use-lazy-tabs";

/**
 * Unified `/outreach/directorio` host (Phase 5 IA consolidation).
 * Three tabs:
 *
 *   - establecimientos  — listing of OutreachEstablishment (default;
 *                          was /outreach/establecimientos)
 *   - descubrir         — Google Places + manual discovery (was
 *                          /outreach/descubrir)
 *   - crawler           — bulk crawler operations (was
 *                          /outreach/crawler-masivo)
 *
 * The `establecimientos/$rbd` detail route stays separate as a leaf.
 * The `/outreach/campanas*` routes stay separate as their own surface.
 *
 * URL state contract:
 *   ?tab=<key>          — active tab (default "establecimientos");
 *                         `replace: true` on change
 *
 * Tab-specific RBAC enforced per-panel via `<ProtectedTab>`. The outer
 * `beforeLoad` only enforces the LOOSEST permission (`read
 * OutreachEstablishment`) so deep-links stay valid for read-only operators.
 */
const tabKey = z.enum(["establecimientos", "descubrir", "crawler"]);
type DirectorioTab = z.infer<typeof tabKey>;

const searchSchema = z.object({
  tab: tabKey.optional().default("establecimientos"),
});

export const Route = createFileRoute("/_authed/outreach/directorio")({
  staticData: {
    nav: { iconKey: "School", label: "Directorio", order: 20, section: "Outreach" },
    permission: { action: "read", subject: "OutreachEstablishment" },
    title: "Directorio",
  },
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    if (!context.can("read", "OutreachEstablishment")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/" });
    }
  },
  component: DirectorioHostPage,
});

function DirectorioHostPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { isTabMounted, markTabAsMounted } = useLazyTabs<DirectorioTab>(tab);

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
      <Tabs aria-label="Directorio" selectedKey={tab} onSelectionChange={onTabChange}>
        <Tabs.ListContainer>
          <Tabs.List
            aria-label="Secciones"
            className="rounded-2xl border border-default-200/60 bg-background/70 p-1"
          >
            <Tabs.Tab id="establecimientos">
              <School size={14} /> Establecimientos
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="descubrir">
              <SearchCode size={14} /> Descubrir
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="crawler">
              <Bot size={14} /> Crawler
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="establecimientos" className="pt-4">
          {isTabMounted("establecimientos") ? (
            <ProtectedTab action="read" subject="OutreachEstablishment">
              <DirectorioEstablecimientosPanel />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="descubrir" className="pt-4">
          {isTabMounted("descubrir") ? (
            <ProtectedTab action="create" subject="OutreachEstablishment">
              <DirectorioDescubrirPanel />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="crawler" className="pt-4">
          {isTabMounted("crawler") ? (
            <ProtectedTab action="update" subject="OutreachEstablishment">
              <DirectorioCrawlerPanel />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
