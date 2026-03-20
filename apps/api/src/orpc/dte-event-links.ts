import {
  dteEventLinksAutoLinkAllPeriodsInputSchema,
  dteEventLinksAutoLinkAllPeriodsResponseSchema,
  dteEventLinksAutoLinkAllPeriodsStartResponseSchema,
  dteEventLinksAutoLinkDayInputSchema,
  dteEventLinksAutoLinkDayResponseSchema,
  dteEventLinksAutoLinkPeriodInputSchema,
  dteEventLinksAutoLinkPeriodResponseSchema,
  dteEventLinksByDayInputSchema,
  dteEventLinksByDayLinkSchema,
  dteEventLinksConfirmInputSchema,
  dteEventLinksConfirmResponseSchema,
  dteEventLinksJobStatusInputSchema,
  dteEventLinksJobStatusResponseSchema,
  dteEventLinksOverviewInputSchema,
  dteEventLinksOverviewResponseSchema,
  dteEventLinksSuggestionsInputSchema,
  dteEventLinksSuggestionsResponseSchema,
  dteEventLinksUnlinkInputSchema,
  dteEventLinksUnlinkResponseSchema,
} from "@finanzas/orpc-contracts/dte-event-links";
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

const eventLinksByDay = readEventLinks
  .route({
    method: "GET",
    path: "/by-day",
    summary: "Lista vinculos confirmados por dia",
  })
  .input(dteEventLinksByDayInputSchema)
  .output(z.array(dteEventLinksByDayLinkSchema))
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
  .input(dteEventLinksSuggestionsInputSchema)
  .output(dteEventLinksSuggestionsResponseSchema)
  .handler(async ({ input }) => {
    return getEventDteSuggestions(input);
  });

const eventLinksOverview = readEventLinks
  .route({
    method: "GET",
    path: "/overview",
    summary: "Resumen paginado de vinculos evento DTE",
  })
  .input(dteEventLinksOverviewInputSchema)
  .output(dteEventLinksOverviewResponseSchema)
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
  .input(dteEventLinksJobStatusInputSchema)
  .output(dteEventLinksJobStatusResponseSchema)
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
  .input(dteEventLinksConfirmInputSchema)
  .output(dteEventLinksConfirmResponseSchema)
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
  .input(dteEventLinksUnlinkInputSchema)
  .output(dteEventLinksUnlinkResponseSchema)
  .handler(async ({ context, input }) => {
    return unlinkEventDteLink({
      ...input,
      userId: context.user.id,
    });
  });

const autoLinkDay = writeEventLinks
  .route({
    method: "POST",
    path: "/auto-link-day",
    summary: "Auto-vincula candidatos confiables de un dia",
  })
  .input(dteEventLinksAutoLinkDayInputSchema)
  .output(dteEventLinksAutoLinkDayResponseSchema)
  .handler(async ({ context, input }) => {
    const parsedInput = dteEventLinksAutoLinkDayInputSchema.parse(input);
    return autoLinkEventDate({
      date: normalizeLinkDate(parsedInput.date),
      minScore: parsedInput.minScore,
      strategy: parsedInput.strategy,
      userId: context.user.id,
    });
  });

const autoLinkPeriod = writeEventLinks
  .route({
    method: "POST",
    path: "/auto-link-period",
    summary: "Auto-vincula candidatos confiables de un periodo",
  })
  .input(dteEventLinksAutoLinkPeriodInputSchema)
  .output(dteEventLinksAutoLinkPeriodResponseSchema)
  .handler(async ({ context, input }) => {
    const parsedInput = dteEventLinksAutoLinkPeriodInputSchema.parse(input);
    return autoLinkEventPeriod({
      minScore: parsedInput.minScore,
      period: parsedInput.period,
      strategy: parsedInput.strategy,
      userId: context.user.id,
    });
  });

const autoLinkAllPeriods = writeEventLinks
  .route({
    method: "POST",
    path: "/auto-link-all-periods",
    summary: "Auto-vincula candidatos confiables de todos los periodos",
  })
  .input(dteEventLinksAutoLinkAllPeriodsInputSchema)
  .output(dteEventLinksAutoLinkAllPeriodsResponseSchema)
  .handler(async ({ context, input }) => {
    const parsedInput = dteEventLinksAutoLinkAllPeriodsInputSchema.parse(input);
    return autoLinkAllEventPeriods({
      minScore: parsedInput.minScore,
      strategy: parsedInput.strategy,
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
  .input(dteEventLinksAutoLinkAllPeriodsInputSchema)
  .output(dteEventLinksAutoLinkAllPeriodsStartResponseSchema)
  .handler(async ({ context, input }) => {
    const parsedInput = dteEventLinksAutoLinkAllPeriodsInputSchema.parse(input);
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
          minScore: parsedInput.minScore,
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
          periodConcurrency: parsedInput.periodConcurrency,
          periods,
          strategy: parsedInput.strategy,
          userId: context.user.id,
        });

        completeJob(jobId, result);
      } catch (error) {
        failJob(jobId, error instanceof Error ? error.message : "Failed to start auto-link job");
      }
    })();

    return {
      jobId,
      periodConcurrency: Math.max(1, Math.min(parsedInput.periodConcurrency ?? 3, 6)),
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
      docsTitle: "Bioalergia DTE Event Links API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia DTE Event Links API",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("dte-event-links.orpc.openapi", error, {});
    }),
  ],
});

export type DteEventLinksORPCRouter = typeof dteEventLinksORPCRouter;
