import { formatChile } from "@/lib/dates";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { z } from "zod";

const dteLinksSearchSchema = z
  .object({
    page: z.coerce.number().int().min(0).optional().catch(0),
    pageSize: z.coerce.number().int().min(10).max(100).optional().catch(25),
    period: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
    query: z.string().optional(),
    status: z.enum(["all", "linked", "pending_issuance", "unlinked"]).optional(),
  })
  .transform((search) => ({
    page: search.page ?? 0,
    pageSize: search.pageSize ?? 25,
    period: search.period ?? formatChile(new Date(), "YYYY-MM"),
    query: search.query,
    status: search.status ?? "all",
  }));

type DteLinksSearchParams = z.infer<typeof dteLinksSearchSchema>;

export const Route = createFileRoute("/_authed/calendar/dte-links")({
  staticData: {
    permission: { action: "read", subject: "DTEPurchaseDetail" },
    title: "Vínculos DTE (legacy)",
  },
  beforeLoad: requirePermission("read", "DTEPurchaseDetail"),
  loader: ({ location }) => {
    const parsed = dteLinksSearchSchema.parse(location.search);
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({
      to: "/finanzas/dte-analytics",
      search: {
        page: parsed.page,
        pageSize: parsed.pageSize,
        period: parsed.period,
        query: parsed.query,
        status: parsed.status,
        tab: "event-links",
      },
    });
  },
  validateSearch: (search: Record<string, unknown>): DteLinksSearchParams =>
    dteLinksSearchSchema.parse(search),
  component: () => null,
});
