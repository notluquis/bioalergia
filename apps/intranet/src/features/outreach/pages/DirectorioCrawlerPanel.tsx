import { OutreachBulkCrawlPage } from "@/features/outreach/pages/OutreachBulkCrawlPage";

/**
 * `/outreach/directorio?tab=crawler` panel — was `/outreach/crawler-masivo`.
 *
 * Wraps the original bulk crawler page so the migration is surface-only.
 */
export function DirectorioCrawlerPanel() {
  return <OutreachBulkCrawlPage />;
}
