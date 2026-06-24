import { MlConnectionPage } from "@/features/catalog/pages/MlConnectionPage";

/**
 * `/store?tab=mercadolibre` panel — was `/settings/mercadolibre`.
 *
 * MercadoLibre OAuth connection + sync status. Wraps the existing page
 * verbatim; no behavior change.
 */
export function StoreMercadoLibrePanel() {
  return <MlConnectionPage />;
}
