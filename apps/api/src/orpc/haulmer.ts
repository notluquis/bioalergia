import { db } from "@finanzas/db";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { haulmerConfig } from "../config";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { captureHaulmerJWT } from "../modules/haulmer/auth";
import { syncPeriods } from "../modules/haulmer/service";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type HaulmerORPCContext = {
  hono: HonoContext;
};

const base = os.$context<HaulmerORPCContext>();

const syncResultSchema = z.object({
  docType: z.enum(["sales", "purchases"]),
  error: z.string().nullable().optional(),
  period: z.string(),
  rowsInserted: z.number(),
  rowsProcessed: z.number(),
  rowsUpdated: z.number(),
  status: z.enum(["failed", "skipped", "success"]),
});

const availablePeriodsResponseSchema = z.object({
  purchases: z.array(
    z.object({
      count: z.number(),
      periodo: z.string(),
    }),
  ),
  sales: z.array(
    z.object({
      count: z.number(),
      periodo: z.string(),
    }),
  ),
  status: z.literal("ok"),
});

const syncInputSchema = z.object({
  docTypes: z.array(z.enum(["sales", "purchases"])).min(1),
  periods: z.array(z.string()).min(1),
});

const incrementalSyncInputSchema = z.object({
  docTypes: z.array(z.enum(["sales", "purchases"])).optional(),
  includeLatestAlreadySynced: z.boolean().optional().default(true),
});

const syncResponseSchema = z.object({
  message: z.string().optional(),
  mode: z.literal("incremental").optional(),
  results: z.array(syncResultSchema),
  status: z.literal("ok"),
  summary: z.object({
    failed: z.number(),
    success: z.number(),
    total: z.number(),
  }),
});

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "Not authorized" });
  }
  return next({ context: { ...context, user } });
});

const readHaulmer = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "Integration");
  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const createHaulmer = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user.id, "create", "Integration");
  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

function requireHaulmerConfig() {
  if (!haulmerConfig) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Haulmer not configured (missing env vars)",
    });
  }
  return haulmerConfig;
}

async function fetchAvailablePeriods() {
  const config = requireHaulmerConfig();
  const jwtResponse = await captureHaulmerJWT({
    email: config.email,
    password: config.password,
    rut: config.rut,
  });
  const jwt = jwtResponse.jwtToken;

  const [salesResponse, purchasesResponse] = await Promise.all([
    fetch(`https://api-frontend.haulmer.com/v3/dte/core/registro/ventas/periodos/${config.rut}`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Origin: "https://espacio.haulmer.com",
        Referer: "https://espacio.haulmer.com/",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        ...(config.workspaceId
          ? {
              resource: config.workspaceId,
              workspace: config.workspaceId,
            }
          : {}),
      },
    }).then((res) => res.json()),
    fetch(`https://api-frontend.haulmer.com/v3/dte/core/registro/compras/periodos/${config.rut}`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Origin: "https://espacio.haulmer.com",
        Referer: "https://espacio.haulmer.com/",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        ...(config.workspaceId
          ? {
              resource: config.workspaceId,
              workspace: config.workspaceId,
            }
          : {}),
      },
    }).then((res) => res.json()),
  ]);

  return {
    purchases: ((purchasesResponse?.details as Array<{ periodo: number; recibidos: number }>) || [])
      .filter((item) => item.recibidos > 0)
      .map((item) => ({
        count: item.recibidos,
        periodo: String(item.periodo),
      }))
      .sort((a, b) => b.periodo.localeCompare(a.periodo)),
    sales: ((salesResponse?.details as Array<{ emitidos: number; periodo: number }>) || [])
      .filter((item) => item.emitidos > 0)
      .map((item) => ({
        count: item.emitidos,
        periodo: String(item.periodo),
      }))
      .sort((a, b) => b.periodo.localeCompare(a.periodo)),
    status: "ok" as const,
  };
}

function uniqueSortedPeriodsDesc(periods: string[]) {
  return Array.from(new Set(periods)).sort((a, b) => b.localeCompare(a));
}

async function syncIncremental(
  input: z.infer<typeof incrementalSyncInputSchema>,
): Promise<z.infer<typeof syncResponseSchema>> {
  const config = requireHaulmerConfig();
  const docTypes =
    input.docTypes && input.docTypes.length > 0
      ? input.docTypes
      : (["sales", "purchases"] as const);
  const available = await fetchAvailablePeriods();

  const availableByDocType: Record<"purchases" | "sales", string[]> = {
    purchases: uniqueSortedPeriodsDesc(available.purchases.map((item) => item.periodo)),
    sales: uniqueSortedPeriodsDesc(available.sales.map((item) => item.periodo)),
  };

  const successfulLogs = await db.haulmerSyncLog.findMany({
    where: {
      docType: { in: [...docTypes] },
      rut: config.rut,
      status: { in: ["SUCCESS", "success"] },
    },
    select: {
      createdAt: true,
      docType: true,
      period: true,
    },
    orderBy: [{ period: "desc" }, { createdAt: "desc" }],
  });

  const latestSyncedByDocType = new Map<"purchases" | "sales", string>();
  for (const item of successfulLogs) {
    if (
      (item.docType === "sales" || item.docType === "purchases") &&
      !latestSyncedByDocType.has(item.docType)
    ) {
      latestSyncedByDocType.set(item.docType, item.period);
    }
  }

  const grouped = new Map<string, Set<"purchases" | "sales">>();

  for (const docType of docTypes) {
    const availablePeriods = availableByDocType[docType];
    const latestSynced = latestSyncedByDocType.get(docType);
    const latestAvailable = availablePeriods[0];

    for (const period of availablePeriods) {
      const isLatestRefresh =
        input.includeLatestAlreadySynced && latestAvailable != null && period === latestAvailable;
      const isNewPeriod = !latestSynced || period > latestSynced;

      if (isLatestRefresh || isNewPeriod) {
        const set = grouped.get(period) ?? new Set<"purchases" | "sales">();
        set.add(docType);
        grouped.set(period, set);
      }
    }
  }

  if (grouped.size === 0) {
    return {
      message: "No hay períodos nuevos para sincronizar",
      mode: "incremental",
      results: [],
      status: "ok",
      summary: {
        failed: 0,
        success: 0,
        total: 0,
      },
    };
  }

  const periods = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a));
  const results = await syncPeriods({
    docTypes: [...docTypes],
    email: config.email,
    password: config.password,
    periods,
    rut: config.rut,
  });
  const filteredResults = results.filter((result) =>
    grouped.get(result.period)?.has(result.docType),
  );

  return {
    mode: "incremental",
    results: filteredResults,
    status: "ok",
    summary: {
      failed: filteredResults.filter((result) => result.status === "failed").length,
      success: filteredResults.filter((result) => result.status === "success").length,
      total: filteredResults.length,
    },
  };
}

const haulmerORPCRouterBase = {
  availablePeriods: readHaulmer
    .route({
      method: "GET",
      path: "/available-periods",
      summary: "List available Haulmer periods",
      tags: ["Haulmer"],
    })
    .output(availablePeriodsResponseSchema)
    .handler(async () => await fetchAvailablePeriods()),

  sync: createHaulmer
    .route({
      method: "POST",
      path: "/sync",
      summary: "Trigger Haulmer sync",
      tags: ["Haulmer"],
    })
    .input(syncInputSchema)
    .output(syncResponseSchema)
    .handler(async ({ input }) => {
      const config = requireHaulmerConfig();
      const results = await syncPeriods({
        docTypes: input.docTypes,
        email: config.email,
        password: config.password,
        periods: input.periods,
        rut: config.rut,
      });

      return {
        results,
        status: "ok" as const,
        summary: {
          failed: results.filter((result) => result.status === "failed").length,
          success: results.filter((result) => result.status === "success").length,
          total: results.length,
        },
      };
    }),

  syncIncremental: createHaulmer
    .route({
      method: "POST",
      path: "/sync/incremental",
      summary: "Trigger incremental Haulmer sync",
      tags: ["Haulmer"],
    })
    .input(incrementalSyncInputSchema)
    .output(syncResponseSchema)
    .handler(async ({ input }) => await syncIncremental(input)),
};

export const haulmerORPCRouter = base
  .prefix("/api/orpc/haulmer")
  .tag("Haulmer")
  .router(haulmerORPCRouterBase);

export const haulmerORPCHandler = new SuperJSONRPCHandler(haulmerORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("haulmer.orpc", error, {
        module: "api",
        operation: "orpc.haulmer",
      });
    }),
  ],
});

export const haulmerOpenAPIHandler = new OpenAPIHandler(haulmerORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsPath: "/api/orpc/haulmer/docs",
      docsTitle: "Bioalergia Haulmer API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Haulmer API",
          version: "1.0.0",
        },
      },
      specPath: "/api/orpc/haulmer/openapi.json",
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("haulmer.openapi", error, {
        module: "api",
        operation: "openapi.haulmer",
      });
    }),
  ],
});
