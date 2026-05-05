import { createFileRoute, redirect } from "@tanstack/react-router";
import { OutreachBulkCrawlPage } from "@/features/outreach/pages/OutreachBulkCrawlPage";

export const Route = createFileRoute("/_authed/outreach/crawler-masivo")({
  staticData: {
    nav: { iconKey: "Bot", label: "Crawler", order: 50, section: "Outreach" },
    permission: { action: "update", subject: "OutreachEstablishment" },
    title: "Crawler masivo",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("update", "OutreachEstablishment")) {
      throw redirect({ to: "/" });
    }
  },
  component: OutreachBulkCrawlPage,
});
