import { OutreachEstablishmentsPage } from "@/features/outreach/pages/OutreachEstablishmentsPage";

/**
 * `/outreach/directorio?tab=establecimientos` panel — was
 * `/outreach/establecimientos`.
 *
 * Wraps the original listing page so the migration is surface-only.
 * The `establecimientos/$rbd` detail route is intentionally NOT
 * consolidated — it remains a leaf detail route reachable from this
 * panel's row-level links.
 */
export function DirectorioEstablecimientosPanel() {
  return <OutreachEstablishmentsPage />;
}
