import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import {
  autoLinkAllEventPeriods,
  autoLinkAllEventPeriodsWithProgress,
  autoLinkEventDate,
  autoLinkEventPeriod,
  confirmEventDteLink,
  getEventDteSuggestions,
  listAutoLinkEligiblePeriods,
  listEventDteLinkOverview,
  listEventDteLinksByDate,
  normalizeLinkDate,
  unlinkEventDteLink,
} from "../services/dte-event-linking";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type DteEventLinksORPCContext = {
  hono: HonoContext;
};

const base = os.$context<DteEventLinksORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }

  return next({
    context: {
      ...context,
      user,
    },
  });
});

const readEventLinks = authed.use(async ({ context, next }) => {
  const canReadCalendar = await hasPermission(context.user.id, "read", "CalendarDaily");
  const canReadDte = await hasPermission(context.user.id, "read", "DTEPurchaseDetail");

  if (!canReadCalendar || !canReadDte) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const readEventLinkJobs = authed.use(async ({ context, next }) => {
  const canReadDte = await hasPermission(context.user.id, "read", "DTEPurchaseDetail");

  if (!canReadDte) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const writeEventLinks = authed.use(async ({ context, next }) => {
  const canWriteCalendar = await hasPermission(context.user.id, "update", "CalendarEvent");
  const canReadDte = await hasPermission(context.user.id, "read", "DTEPurchaseDetail");

  if (!canWriteCalendar || !canReadDte) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const writeEventLinksWithoutDteRead = authed.use(async ({ context, next }) => {
  const canWriteCalendar = await hasPermission(context.user.id, "update", "CalendarEvent");

  if (!canWriteCalendar) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const eventLinkByDayInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const eventLinkOverviewInputSchema = z.object({
  page: z.coerce.number().int().min(0).default(0).optional(),
  pageSize: z.coerce.number().int().min(10).max(100).default(25).optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  query: z.string().optional(),
  status: z.enum(["all", "linked", "pending_issuance", "unlinked"]).default("all").optional(),
});

const eventLinkSuggestionsInputSchema = z.object({
  calendarId: z.string().min(1),
  eventId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(30).optional(),
});

const jobStatusInputSchema = z.object({
  jobId: z.string().min(1),
});

const confirmEventLinkInputSchema = z.object({
  calendarId: z.string().min(1),
  confidenceScore: z.number().min(0).max(100).optional(),
  dteSaleDetailId: z.string().min(1),
  eventId: z.string().min(1),
  matchedBy: z.enum(["manual", "mixed", "name_exact", "name_fuzzy", "rut"]).optional(),
  matchedName: z.string().nullable().optional(),
  matchedRUT: z.string().nullable().optional(),
});

const unlinkEventLinkInputSchema = z.object({
  calendarId: z.string().min(1),
  eventId: z.string().min(1),
});

const autoLinkDayInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minScore: z.number().min(0).max(100).optional(),
});

const autoLinkPeriodInputSchema = z.object({
  minScore: z.number().min(0).max(100).optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
});

const autoLinkAllPeriodsInputSchema = z.object({
  minScore: z.number().min(0).max(100).optional(),
  periodConcurrency: z.coerce.number().int().min(1).max(6).optional(),
});

const eventDteSuggestionSchema = z.object({
  clientName: z.string(),
  clientRUT: z.string(),
  confidenceScore: z.number(),
  documentDate: z.string(),
  documentType: z.number(),
  dteSaleDetailId: z.string(),
  exemptAmount: z.number(),
  folio: z.string(),
  ivaAmount: z.number(),
  method: z.enum(["mixed", "name_exact", "name_fuzzy", "rut"]),
  netAmount: z.number(),
  reasons: z.array(z.string()),
  registerNumber: z.number(),
  totalAmount: z.number(),
});

const byDayLinkSchema = z.object({
  calendarId: z.string(),
  clientName: z.string(),
  clientRUT: z.string(),
  confidenceScore: z.number(),
  dteSaleDetailId: z.string(),
  eventId: z.string(),
  folio: z.string(),
  matchedBy: z.string(),
  status: z.string(),
  totalAmount: z.number(),
});

const suggestionsResponseSchema = z.object({
  event: z
    .object({
      amountExpected: z.number().nullable(),
      amountPaid: z.number().nullable(),
      calendarId: z.string(),
      description: z.string().nullable(),
      eventDate: z.string(),
      eventId: z.string(),
      hints: z.object({
        nameHints: z.array(z.string()),
        rutHints: z.array(z.string()),
      }),
      summary: z.string().nullable(),
    })
    .nullable(),
  linked: z.unknown().nullable(),
  suggestions: z.array(eventDteSuggestionSchema),
});

const overviewResponseSchema = z.object({
  items: z.array(
    z.object({
      amountExpected: z.number().nullable(),
      amountPaid: z.number().nullable(),
      calendarId: z.string(),
      confidenceScore: z.number().nullable(),
      eventDate: z.string(),
      eventId: z.string(),
      linkStatus: z.enum(["linked", "pending_issuance", "unlinked"]),
      linked: z.boolean(),
      linkedClientName: z.string().nullable(),
      linkedClientRUT: z.string().nullable(),
      linkedDteSaleDetailId: z.string().nullable(),
      linkedFolio: z.string().nullable(),
      linkedMatchedBy: z.string().nullable(),
      linkedTotalAmount: z.number().nullable(),
      summary: z.string().nullable(),
      topSuggestion: eventDteSuggestionSchema
        .extend({
          amountDiff: z.number().nullable(),
        })
        .nullable(),
    }),
  ),
  page: z.number(),
  pageSize: z.number(),
  period: z.string(),
  stats: z.object({
    avgLinkedScore: z.number(),
    dueEvents: z.number(),
    linkRate: z.number(),
    linkedEvents: z.number(),
    pendingIssuanceEvents: z.number(),
    totalEvents: z.number(),
    unlinkedEvents: z.number(),
    withPerfectScore: z.number(),
  }),
  totalCount: z.number(),
  totalPages: z.number(),
});

const jobStatusResponseSchema = z.object({
  error: z.string().nullable(),
  id: z.string(),
  message: z.string(),
  progress: z.number(),
  result: z.unknown(),
  status: z.enum(["completed", "failed", "pending", "running"]),
  total: z.number(),
  type: z.string(),
});

const confirmResponseSchema = z.unknown().nullable();

const unlinkResponseSchema = z.object({
  deleted: z.boolean(),
});

const autoLinkDayResponseSchema = z.object({
  date: z.string(),
  details: z.array(
    z.object({
      eventId: z.string(),
      reason: z.string(),
    }),
  ),
  linked: z.number(),
  skipped: z.number(),
  skippedByReason: z.array(
    z.object({
      count: z.number(),
      reason: z.string(),
    }),
  ),
  totalEvents: z.number(),
});

const autoLinkPeriodResponseSchema = z.object({
  daysProcessed: z.number(),
  details: z.array(
    z.object({
      date: z.string(),
      linked: z.number(),
      skipped: z.number(),
      totalEvents: z.number(),
    }),
  ),
  linked: z.number(),
  period: z.string(),
  skipped: z.number(),
  skippedByReason: z.array(
    z.object({
      count: z.number(),
      reason: z.string(),
    }),
  ),
  totalEvents: z.number(),
});

const autoLinkAllPeriodsResponseSchema = z.object({
  details: z.array(
    z.object({
      daysProcessed: z.number(),
      linked: z.number(),
      period: z.string(),
      skipped: z.number(),
      totalEvents: z.number(),
    }),
  ),
  linked: z.number(),
  periodsProcessed: z.number(),
  skipped: z.number(),
  skippedByReason: z.array(
    z.object({
      count: z.number(),
      reason: z.string(),
    }),
  ),
  totalEvents: z.number(),
});

const autoLinkAllPeriodsStartResponseSchema = z.object({
  jobId: z.string(),
  periodConcurrency: z.number(),
  totalPeriods: z.number(),
});

const eventLinksByDay = readEventLinks
  .route({
    method: "GET",
    path: "/by-day",
    summary: "Lista vinculos confirmados por dia",
  })
  .input(eventLinkByDayInputSchema)
  .output(z.array(byDayLinkSchema))
  .handler(async ({ input }) => {
    const normalizedDate = normalizeLinkDate(input.date);
    return listEventDteLinksByDate(normalizedDate);
  });

const eventLinkSuggestions = readEventLinks
  .route({
    method: "GET",
    path: "/suggestions",
    summary: "Sugiere DTE para un evento",
  })
  .input(eventLinkSuggestionsInputSchema)
  .output(suggestionsResponseSchema)
  .handler(async ({ input }) => {
    return getEventDteSuggestions(input);
  });

const eventLinksOverview = readEventLinks
  .route({
    method: "GET",
    path: "/overview",
    summary: "Resumen paginado de vinculos evento DTE",
  })
  .input(eventLinkOverviewInputSchema)
  .output(overviewResponseSchema)
  .handler(async ({ input }) => {
    return listEventDteLinkOverview({
      page: input.page,
      pageSize: input.pageSize,
      period: input.period,
      query: input.query,
      status: input.status,
    });
  });

const autoLinkJobStatus = readEventLinkJobs
  .route({
    method: "GET",
    path: "/jobs/{jobId}",
    summary: "Consulta estado de job async de auto-link",
  })
  .input(jobStatusInputSchema)
  .output(jobStatusResponseSchema)
  .handler(async ({ input }) => {
    const { getJobStatus } = await import("../lib/jobQueue");
    const job = getJobStatus(input.jobId);

    if (!job || job.type !== "dte-auto-link-all-periods") {
      throw new ORPCError("NOT_FOUND", { message: "Job not found or expired" });
    }

    return {
      id: job.id,
      message: job.message,
      progress: job.progress,
      result: job.result,
      status: job.status,
      total: job.total,
      type: job.type,
      error: job.error,
    };
  });

const confirmLink = writeEventLinks
  .route({
    method: "POST",
    path: "/confirm",
    summary: "Confirma o sobreescribe un vinculo evento DTE",
  })
  .input(confirmEventLinkInputSchema)
  .output(confirmResponseSchema)
  .handler(async ({ context, input }) => {
    return confirmEventDteLink({
      ...input,
      userId: context.user.id,
    });
  });

const unlinkLink = writeEventLinksWithoutDteRead
  .route({
    method: "POST",
    path: "/unlink",
    summary: "Elimina un vinculo confirmado",
  })
  .input(unlinkEventLinkInputSchema)
  .output(unlinkResponseSchema)
  .handler(async ({ input }) => {
    return unlinkEventDteLink(input);
  });

const autoLinkDay = writeEventLinks
  .route({
    method: "POST",
    path: "/auto-link-day",
    summary: "Auto-vincula candidatos confiables de un dia",
  })
  .input(autoLinkDayInputSchema)
  .output(autoLinkDayResponseSchema)
  .handler(async ({ context, input }) => {
    return autoLinkEventDate({
      date: normalizeLinkDate(input.date),
      minScore: input.minScore,
      userId: context.user.id,
    });
  });

const autoLinkPeriod = writeEventLinks
  .route({
    method: "POST",
    path: "/auto-link-period",
    summary: "Auto-vincula candidatos confiables de un periodo",
  })
  .input(autoLinkPeriodInputSchema)
  .output(autoLinkPeriodResponseSchema)
  .handler(async ({ context, input }) => {
    return autoLinkEventPeriod({
      minScore: input.minScore,
      period: input.period,
      userId: context.user.id,
    });
  });

const autoLinkAllPeriods = writeEventLinks
  .route({
    method: "POST",
    path: "/auto-link-all-periods",
    summary: "Auto-vincula candidatos confiables de todos los periodos",
  })
  .input(autoLinkAllPeriodsInputSchema)
  .output(autoLinkAllPeriodsResponseSchema)
  .handler(async ({ context, input }) => {
    return autoLinkAllEventPeriods({
      minScore: input.minScore,
      userId: context.user.id,
    });
  });

const startAutoLinkAllPeriods = writeEventLinks
  .route({
    method: "POST",
    path: "/auto-link-all-periods/start",
    successStatus: 202,
    summary: "Inicia job async de auto-link de todos los periodos",
  })
  .input(autoLinkAllPeriodsInputSchema)
  .output(autoLinkAllPeriodsStartResponseSchema)
  .handler(async ({ context, input }) => {
    const { completeJob, failJob, startJob, updateJobProgress } = await import("../lib/jobQueue");
    const periods = await listAutoLinkEligiblePeriods();
    const jobId = startJob("dte-auto-link-all-periods", Math.max(periods.length, 1));

    void (async () => {
      try {
        if (periods.length === 0) {
          updateJobProgress(jobId, 1, "Sin períodos elegibles para auto-vincular");
          completeJob(jobId, {
            details: [],
            linked: 0,
            periodsProcessed: 0,
            skipped: 0,
            skippedByReason: [],
            totalEvents: 0,
          });
          return;
        }

        const result = await autoLinkAllEventPeriodsWithProgress({
          minScore: input.minScore,
          onProgress: (snapshot) => {
            const boundedProgress = Math.max(
              0,
              Math.min(snapshot.completedPeriods, periods.length),
            );
            updateJobProgress(
              jobId,
              boundedProgress,
              `Período ${snapshot.currentPeriod} listo (${snapshot.completedPeriods}/${snapshot.totalPeriods}) · Vinculados ${snapshot.linked} · Omitidos ${snapshot.skipped}`,
            );
          },
          periodConcurrency: input.periodConcurrency,
          periods,
          userId: context.user.id,
        });

        completeJob(jobId, result);
      } catch (error) {
        failJob(jobId, error instanceof Error ? error.message : "Failed to start auto-link job");
      }
    })();

    return {
      jobId,
      periodConcurrency: Math.max(1, Math.min(input.periodConcurrency ?? 3, 6)),
      totalPeriods: periods.length,
    };
  });

const dteEventLinksORPCRouterBase = {
  autoLinkJobStatus,
  autoLinkAllPeriods,
  autoLinkDay,
  autoLinkPeriod,
  byDay: eventLinksByDay,
  confirmLink,
  overview: eventLinksOverview,
  suggestions: eventLinkSuggestions,
  startAutoLinkAllPeriods,
  unlinkLink,
};

export const dteEventLinksORPCRouter = base
  .prefix("/api/orpc/dte-analytics/event-links")
  .tag("DTE Event Links")
  .router(dteEventLinksORPCRouterBase);

export const dteEventLinksORPCHandler = new SuperJSONRPCHandler(dteEventLinksORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("dte-event-links.orpc.rpc", error, {});
    }),
  ],
});

export const dteEventLinksOpenAPIHandler = new OpenAPIHandler(dteEventLinksORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsPath: "/api/orpc/dte-analytics/event-links/docs",
      docsTitle: "Bioalergia DTE Event Links API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia DTE Event Links API",
          version: "1.0.0",
        },
      },
      specPath: "/api/orpc/dte-analytics/event-links/openapi.json",
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("dte-event-links.orpc.openapi", error, {});
    }),
  ],
});

export type DteEventLinksORPCRouter = typeof dteEventLinksORPCRouter;
