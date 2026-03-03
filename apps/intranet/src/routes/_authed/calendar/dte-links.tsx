import { Skeleton } from "@heroui/react";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import dayjs from "dayjs";
import { lazy, Suspense } from "react";
import { z } from "zod";

import { fetchEventDteLinksOverview } from "@/features/calendar/api";

const CalendarDteLinksPage = lazy(() =>
  import("@/pages/CalendarDteLinksPage").then((m) => ({ default: m.CalendarDteLinksPage })),
);

const routeApi = getRouteApi("/_authed/calendar/dte-links");

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
    period: search.period ?? dayjs().format("YYYY-MM"),
    query: search.query,
    status: search.status ?? "all",
  }));

type DteLinksSearchParams = z.infer<typeof dteLinksSearchSchema>;

export const Route = createFileRoute("/_authed/calendar/dte-links")({
  staticData: {
    nav: { iconKey: "Link2", label: "Vínculos DTE", order: 3, section: "Calendario" },
    permission: { action: "read", subject: "CalendarDaily" },
    title: "Vínculos DTE",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "CalendarDaily")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  validateSearch: (search: Record<string, unknown>): DteLinksSearchParams =>
    dteLinksSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  component: () => (
    <Suspense
      fallback={
        <div className="space-y-3 p-4">
          <Skeleton className="h-12 w-56 rounded-lg" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      }
    >
      <CalendarDteLinksPage />
    </Suspense>
  ),
  loader: async ({ deps }) => {
    await fetchEventDteLinksOverview({
      page: deps.page,
      pageSize: deps.pageSize,
      period: deps.period,
      query: deps.query,
      status: deps.status,
    });
  },
});
