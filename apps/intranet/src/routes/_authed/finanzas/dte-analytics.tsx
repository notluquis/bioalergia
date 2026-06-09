import { formatChile } from "@/lib/dates";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { z } from "zod";

import { DTEAnalyticsPage } from "@/pages/finanzas/DTEAnalyticsPage";

const dteAnalyticsSearchSchema = z
  .object({
    page: z.coerce.number().int().min(0).optional().catch(0),
    pageSize: z.coerce.number().int().min(10).max(100).optional().catch(25),
    period: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
    query: z.string().optional(),
    status: z.enum(["all", "linked", "pending_issuance", "unlinked"]).optional(),
    tab: z
      .enum([
        "event-links",
        "purchases-comparison",
        "purchases-details",
        "purchases-monthly",
        "sales-comparison",
        "sales-details",
        "sales-monthly",
      ])
      .optional(),
  })
  .transform((search) => ({
    page: search.page ?? 0,
    pageSize: search.pageSize ?? 25,
    period: search.period ?? formatChile(new Date(), "YYYY-MM"),
    query: search.query,
    status: search.status ?? "all",
    tab: search.tab ?? "purchases-monthly",
  }));

export const Route = createFileRoute("/_authed/finanzas/dte-analytics")({
  component: DTEAnalyticsPage,
  staticData: {
    nav: {
      iconKey: "ScanBarcode",
      label: "DTE (analytics)",
      order: 60,
      section: "Finanzas",
    },
    permission: { action: "read", subject: "DTEPurchaseDetail" },
    relatedSubjects: ["DTEPeriod", "DTESaleDetail", "DTESyncLog"],
    title: "Análisis de DTEs",
  },
  beforeLoad: requirePermission("read", "DTEPurchaseDetail"),
  validateSearch: (search: Record<string, unknown>) => dteAnalyticsSearchSchema.parse(search),
});
