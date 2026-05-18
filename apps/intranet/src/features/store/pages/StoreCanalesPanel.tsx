import { TiendaSettingsPage } from "@/pages/settings/TiendaSettingsPage";

/**
 * `/store?tab=canales` panel — was `/settings/tienda`.
 *
 * Storefront-facing config: low-stock badge threshold, shipping/canal
 * prices live here. Wraps the original page so the migration is
 * surface-only (no behavior diff).
 */
export function StoreCanalesPanel() {
  return <TiendaSettingsPage />;
}
