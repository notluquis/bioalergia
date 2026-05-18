import { Tabs } from "@heroui/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ClipboardList, Package, Settings } from "lucide-react";
import { useCallback } from "react";
import { z } from "zod";

import { ProtectedTab } from "@/components/auth/ProtectedTab";
import { InventoryConfiguracionPanel } from "@/features/inventory/pages/InventoryConfiguracionPanel";
import { InventoryItemsPanel } from "@/features/inventory/pages/InventoryItemsPanel";
import { InventoryMovimientosPanel } from "@/features/inventory/pages/InventoryMovimientosPanel";
import { inventoryKeys } from "@/features/inventory/queries";
import { useLazyTabs } from "@/hooks/use-lazy-tabs";

/**
 * Unified `/inventory` host (Phase 4a IA consolidation). Three tabs:
 *
 *   - items          — full inventory table (default); category column
 *                      filters serve as "clinical supplies vs store
 *                      products vs all" quick filters
 *   - movimientos    — audit log placeholder + stock adjustments
 *   - configuracion  — categories + common-supply registry
 *                      (was /settings/inventario)
 *
 * URL state contract:
 *   ?tab=<key>       — active tab; `replace: true` on change
 *
 * Outer route enforces `read InventoryItem` (loosest). Per-tab RBAC
 * (e.g. `update InventorySetting`) lives in `<ProtectedTab>` wrappers.
 */
const tabKey = z.enum(["items", "movimientos", "configuracion"]);
type InventoryTab = z.infer<typeof tabKey>;

const searchSchema = z.object({
  tab: tabKey.optional().default("items"),
});

export const Route = createFileRoute("/_authed/inventory/")({
  staticData: {
    nav: {
      iconKey: "Package",
      label: "Inventario",
      order: 20,
      section: "Logística",
    },
    permission: { action: "read", subject: "InventoryItem" },
    relatedSubjects: ["InventoryCategory", "InventoryMovement", "InventorySetting", "CommonSupply"],
    title: "Inventario",
  },
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    if (!context.can("read", "InventoryItem")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/" });
    }
  },
  loader: ({ context: { queryClient } }) => {
    return queryClient.ensureQueryData(inventoryKeys.items());
  },
  component: InventoryHostPage,
});

function InventoryHostPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { isTabMounted, markTabAsMounted } = useLazyTabs<InventoryTab>(tab);

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
      <Tabs aria-label="Inventario" selectedKey={tab} onSelectionChange={onTabChange}>
        <Tabs.ListContainer>
          <Tabs.List
            aria-label="Secciones"
            className="rounded-2xl border border-default-200/60 bg-background/70 p-1"
          >
            <Tabs.Tab id="items">
              <Package size={14} /> Items
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="movimientos">
              <ClipboardList size={14} /> Movimientos
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="configuracion">
              <Settings size={14} /> Configuración
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="items" className="pt-4">
          {isTabMounted("items") ? (
            <ProtectedTab action="read" subject="InventoryItem">
              <InventoryItemsPanel />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="movimientos" className="pt-4">
          {isTabMounted("movimientos") ? (
            <ProtectedTab action="read" subject="InventoryMovement">
              <InventoryMovimientosPanel />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="configuracion" className="pt-4">
          {isTabMounted("configuracion") ? (
            <ProtectedTab action="update" subject="InventorySetting">
              <InventoryConfiguracionPanel />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
