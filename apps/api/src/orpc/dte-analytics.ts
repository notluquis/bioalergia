import {
  dteAnalyticsDetailsQuerySchema,
  dteAnalyticsPeriodParamsSchema,
  dteAnalyticsPeriodsResponseSchema,
  dteAnalyticsPurchasesDetailsResponseSchema,
  dteAnalyticsSalesLinkedEventsQuerySchema,
  dteAnalyticsSalesLinkedEventsResponseSchema,
  dteAnalyticsSalesDetailsResponseSchema,
  dteAnalyticsSummaryResponseSchema,
  dteFetchXmlByPeriodInputSchema,
  dteFetchXmlByPeriodResponseSchema,
  dteFetchXmlInputSchema,
  dteFetchXmlResponseSchema,
  dteLineItemsQuerySchema,
  dteLineItemsResponseSchema,
  dteXmlJobStatusResponseSchema,
} from "@finanzas/orpc-contracts/dte-analytics";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import type { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  getLineItems,
  getPurchasesAvailablePeriods,
  getPurchasesDetails,
  getPurchasesSummary,
  getSalesAvailablePeriods,
  getSalesDetails,
  getSalesLinkedEvents,
  getSalesSummary,
  selectDtesForXmlFetch,
} from "../services/dte-analytics.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type DteAnalyticsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<DteAnalyticsORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "Unauthorized" });
  }

  return next({
    context: {
      ...context,
      user,
    },
  });
});

const readDteAnalytics = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "DTEPurchaseDetail");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const dteAnalyticsORPCRouterBase = {
  purchasesAvailablePeriods: readDteAnalytics
    .route({ method: "GET", path: "/purchases/available-periods" })
    .output(dteAnalyticsPeriodsResponseSchema)
    .handler(() => getPurchasesAvailablePeriods()),

  purchasesDetails: readDteAnalytics
    .route({ method: "GET", path: "/purchases/details" })
    .input(dteAnalyticsDetailsQuerySchema)
    .output(dteAnalyticsPurchasesDetailsResponseSchema)
    .handler(({ input }: { input: z.output<typeof dteAnalyticsDetailsQuerySchema> }) =>
      getPurchasesDetails(input)
    ),

  purchasesSummary: readDteAnalytics
    .route({ method: "GET", path: "/purchases/summary" })
    .input(dteAnalyticsPeriodParamsSchema)
    .output(dteAnalyticsSummaryResponseSchema)
    .handler(({ input }: { input: z.output<typeof dteAnalyticsPeriodParamsSchema> }) =>
      getPurchasesSummary(input)
    ),

  salesAvailablePeriods: readDteAnalytics
    .route({ method: "GET", path: "/sales/available-periods" })
    .output(dteAnalyticsPeriodsResponseSchema)
    .handler(() => getSalesAvailablePeriods()),

  salesDetails: readDteAnalytics
    .route({ method: "GET", path: "/sales/details" })
    .input(dteAnalyticsDetailsQuerySchema)
    .output(dteAnalyticsSalesDetailsResponseSchema)
    .handler(({ input }: { input: z.output<typeof dteAnalyticsDetailsQuerySchema> }) =>
      getSalesDetails(input)
    ),

  salesLinkedEvents: readDteAnalytics
    .route({ method: "GET", path: "/sales/linked-events" })
    .input(dteAnalyticsSalesLinkedEventsQuerySchema)
    .output(dteAnalyticsSalesLinkedEventsResponseSchema)
    .handler(({ input }: { input: z.output<typeof dteAnalyticsSalesLinkedEventsQuerySchema> }) =>
      getSalesLinkedEvents(input)
    ),

  salesSummary: readDteAnalytics
    .route({ method: "GET", path: "/sales/summary" })
    .input(dteAnalyticsPeriodParamsSchema)
    .output(dteAnalyticsSummaryResponseSchema)
    .handler(({ input }: { input: z.output<typeof dteAnalyticsPeriodParamsSchema> }) =>
      getSalesSummary(input)
    ),

  lineItems: readDteAnalytics
    .route({ method: "GET", path: "/line-items" })
    .input(dteLineItemsQuerySchema)
    .output(dteLineItemsResponseSchema)
    .handler(({ input }: { input: z.output<typeof dteLineItemsQuerySchema> }) =>
      getLineItems(input)
    ),

  fetchXml: readDteAnalytics
    .route({ method: "POST", path: "/fetch-xml" })
    .input(dteFetchXmlInputSchema)
    .output(dteFetchXmlResponseSchema)
    .handler(async ({ input }: { input: z.output<typeof dteFetchXmlInputSchema> }) => {
      const { haulmerConfig: cfg } = await import("../lib/config.ts");
      if (!cfg) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Haulmer not configured (missing env vars)",
        });
      }

      const { fetchSaleXmlLineItems, fetchPurchaseXmlLineItems } =
        await import("../modules/haulmer/xml-service.ts");

      const result =
        input.direction === "sales"
          ? await fetchSaleXmlLineItems(input.dteIds, cfg)
          : await fetchPurchaseXmlLineItems(input.dteIds, cfg);

      return { ...result, status: "success" as const };
    }),

  fetchXmlByPeriod: readDteAnalytics
    .route({ method: "POST", path: "/fetch-xml-by-period" })
    .input(dteFetchXmlByPeriodInputSchema)
    .output(dteFetchXmlByPeriodResponseSchema)
    .handler(async ({ input }: { input: z.output<typeof dteFetchXmlByPeriodInputSchema> }) => {
      const { haulmerConfig: cfg } = await import("../lib/config.ts");
      if (!cfg) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Haulmer not configured (missing env vars)",
        });
      }

      const dteIds = await selectDtesForXmlFetch({
        direction: input.direction,
        onlyMissing: input.onlyMissing,
        period: input.period,
      });

      if (dteIds.length === 0) {
        return { jobId: "none", total: 0, status: "success" as const };
      }

      const { startXmlFetchJob } = await import("../modules/haulmer/xml-service.ts");
      const jobId = startXmlFetchJob(dteIds, input.direction, cfg);

      return { jobId, total: dteIds.length, status: "success" as const };
    }),

  xmlJobStatus: readDteAnalytics
    .route({ method: "GET", path: "/xml-job-status" })
    .output(dteXmlJobStatusResponseSchema)
    .handler(async () => {
      const { getActiveXmlFetchJob } = await import("../modules/haulmer/xml-service.ts");

      const activeJob = getActiveXmlFetchJob();
      if (activeJob) {
        return {
          job: {
            id: activeJob.id,
            status: activeJob.status,
            progress: activeJob.progress,
            total: activeJob.total,
            message: activeJob.message,
            meta: activeJob.meta,
            error: activeJob.error,
          },
          status: "success" as const,
        };
      }

      return { job: null, status: "success" as const };
    }),
};

export const dteAnalyticsORPCRouter = base
  .prefix("/api/orpc/dte-analytics")
  .router(dteAnalyticsORPCRouterBase);

export const dteAnalyticsORPCHandler = new SuperJSONRPCHandler(dteAnalyticsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.dte-analytics",
      });
    }),
  ],
});

export const dteAnalyticsOpenAPIHandler = new OpenAPIHandler(dteAnalyticsORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia DTE Analytics oRPC",
          description: "Contratos oRPC/OpenAPI para resúmenes y detalles DTE.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.dte-analytics",
      });
    }),
  ],
});

export type DteAnalyticsORPCRouter = typeof dteAnalyticsORPCRouter;
