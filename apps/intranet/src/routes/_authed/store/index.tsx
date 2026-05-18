import { Tabs } from "@heroui/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { CreditCard, Package, ShoppingBag, Store } from "lucide-react";
import { useCallback } from "react";
import { z } from "zod";

import { ProtectedTab } from "@/components/auth/ProtectedTab";
import { StoreCanalesPanel } from "@/features/store/pages/StoreCanalesPanel";
import { StoreMercadoLibrePanel } from "@/features/store/pages/StoreMercadoLibrePanel";
import { StoreMercadoPagoPanel } from "@/features/store/pages/StoreMercadoPagoPanel";
import { StoreProductosPanel } from "@/features/store/pages/StoreProductosPanel";
import { useLazyTabs } from "@/hooks/use-lazy-tabs";

/**
 * Unified `/store` host (Phase 4a IA consolidation). Four tabs:
 *
 *   - canales       — canal prices + shipping + low-stock threshold
 *                     (was /settings/tienda); default
 *   - productos     — store catalog (PG-master products visible online)
 *   - mercadopago   — MP integration (was /settings/mercadopago)
 *   - mercadolibre  — ML connection + sync (was /settings/mercadolibre)
 *
 * URL state contract:
 *   ?tab=<key>      — active tab; `replace: true` on change
 *
 * Tab-specific RBAC enforced per-panel via `<ProtectedTab>`. The outer
 * `beforeLoad` only enforces the LOOSEST permission (`read Setting`)
 * so deep-links stay valid for read-only operators.
 */
const tabKey = z.enum(["canales", "productos", "mercadopago", "mercadolibre"]);
type StoreTab = z.infer<typeof tabKey>;

const searchSchema = z.object({
  tab: tabKey.optional().default("canales"),
});

export const Route = createFileRoute("/_authed/store/")({
  staticData: {
    nav: {
      iconKey: "ShoppingBag",
      label: "Tienda",
      order: 40,
      section: "Logística",
    },
    permission: { action: "read", subject: "Setting" },
    relatedSubjects: ["InventoryItem", "Integration", "Product"],
    title: "Tienda",
  },
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Setting")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/" });
    }
  },
  component: StoreHostPage,
});

function StoreHostPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { isTabMounted, markTabAsMounted } = useLazyTabs<StoreTab>(tab);

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
      <Tabs aria-label="Tienda" selectedKey={tab} onSelectionChange={onTabChange}>
        <Tabs.ListContainer>
          <Tabs.List
            aria-label="Secciones"
            className="rounded-2xl border border-default-200/60 bg-background/70 p-1"
          >
            <Tabs.Tab id="canales">
              <Store size={14} /> Canales
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="productos">
              <Package size={14} /> Productos
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="mercadopago">
              <CreditCard size={14} /> MercadoPago
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="mercadolibre">
              <ShoppingBag size={14} /> MercadoLibre
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="canales" className="pt-4">
          {isTabMounted("canales") ? (
            <ProtectedTab action="update" subject="Setting">
              <StoreCanalesPanel />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="productos" className="pt-4">
          {isTabMounted("productos") ? (
            <ProtectedTab action="read" subject="InventoryItem">
              <StoreProductosPanel />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="mercadopago" className="pt-4">
          {isTabMounted("mercadopago") ? (
            <ProtectedTab action="read" subject="Integration">
              <StoreMercadoPagoPanel />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="mercadolibre" className="pt-4">
          {isTabMounted("mercadolibre") ? (
            <ProtectedTab action="update" subject="Setting">
              <StoreMercadoLibrePanel />
            </ProtectedTab>
          ) : null}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
