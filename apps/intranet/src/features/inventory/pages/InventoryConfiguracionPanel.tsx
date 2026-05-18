import { InventorySettingsPage } from "@/pages/settings/InventorySettingsPage";

/**
 * `/inventory?tab=configuracion` panel — was `/settings/inventario`.
 *
 * Category management + common-supply registry. Wraps the existing
 * settings page so the migration is surface-only.
 */
export function InventoryConfiguracionPanel() {
  return <InventorySettingsPage />;
}
