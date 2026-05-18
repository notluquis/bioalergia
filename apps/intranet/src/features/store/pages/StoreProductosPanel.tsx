import { CatalogPage } from "@/features/catalog/pages/CatalogPage";

/**
 * `/store?tab=productos` panel — store-product catalog (PG-master).
 *
 * Reuses the existing `CatalogPage` (operations/catalog) which already
 * filters to store-published products. Inventory CRUD lives at
 * `/inventory`; this tab is the storefront view of the same data.
 */
export function StoreProductosPanel() {
  return <CatalogPage />;
}
