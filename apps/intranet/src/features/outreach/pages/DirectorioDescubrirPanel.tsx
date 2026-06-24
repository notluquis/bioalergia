import { OutreachDiscoverPage } from "@/features/outreach/pages/OutreachDiscoverPage";

/**
 * `/outreach/directorio?tab=descubrir` panel — was `/outreach/descubrir`.
 *
 * Wraps the original discovery page so the migration is surface-only.
 */
export function DirectorioDescubrirPanel() {
  return <OutreachDiscoverPage />;
}
