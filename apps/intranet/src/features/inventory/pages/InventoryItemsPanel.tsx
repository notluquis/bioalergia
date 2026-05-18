import { InventoryPage } from "@/features/operations/inventory/pages/InventoryPage";

/**
 * `/inventory?tab=items` panel — full inventory items table.
 *
 * Wraps the existing `InventoryPage` (was at `/operations/inventory`).
 * Built-in column filters (category, allergy type) act as the
 * "clinical supplies vs store products vs all" quick filters mentioned
 * in the IA plan; no extra UI needed at the wrapper level.
 */
export function InventoryItemsPanel() {
  return <InventoryPage />;
}
