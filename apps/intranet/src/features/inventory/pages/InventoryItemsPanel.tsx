import { InventoryPage } from "./InventoryPage";

/**
 * `/inventory?tab=items` panel — full inventory items table.
 *
 * Wraps the existing `InventoryPage` (now colocated under `features/inventory`).
 * Built-in column filters (category, allergy type) act as the
 * "clinical supplies vs store products vs all" quick filters mentioned
 * in the IA plan; no extra UI needed at the wrapper level.
 */
export function InventoryItemsPanel() {
  return <InventoryPage />;
}
