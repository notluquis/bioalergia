/**
 * Haulmer Integration Routes
 * Sync CSV downloads from Haulmer DTE registry
 */

import { db } from "@finanzas/db";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { haulmerConfig } from "../config";
import { captureHaulmerJWT } from "../modules/haulmer/auth";
import { syncPeriods } from "../modules/haulmer/service";
import { reply } from "../utils/reply";

export const haulmerRoutes = new Hono();

const incrementalSyncSchema = z.object({
  docTypes: z.array(z.enum(["sales", "purchases"])).optional(),
  includeLatestAlreadySynced: z.boolean().optional().default(true),
});

function uniqueSortedPeriodsDesc(periods: string[]) {
  return Array.from(new Set(periods)).sort((a, b) => b.localeCompare(a));
}

/**
 * GET /haulmer/available-periods
 * Get available sales and purchase periods from Haulmer
 */
haulmerRoutes.get("/available-periods", async (c: Context) => {
  try {
    const user = await getSessionUser(c);
    if (!user) {
      console.warn("[Haulmer] GET /available-periods: No authenticated user");
      return reply(c, { status: "error", message: "Not authorized" }, 401);
    }

    const canRead = await hasPermission(user.id, "read", "Integration");
    if (!canRead) {
      console.warn(
        `[Haulmer] GET /available-periods: User ${user.id} lacks 'read' Integration permission`,
      );
      return reply(
        c,
        { status: "error", message: "Forbidden: missing 'read' Integration permission" },
        403,
      );
    }

    if (!haulmerConfig) {
      console.warn("[Haulmer] GET /available-periods: haulmerConfig is null (missing env vars)");
      return reply(
        c,
        {
          status: "error",
          message:
            "Haulmer not configured (missing env vars: HAULMER_RUT, HAULMER_EMAIL, HAULMER_PASSWORD, HAULMER_WORKSPACE_ID)",
        },
        503,
      );
    }

    console.log(
      `[Haulmer] GET /available-periods: User ${user.id} authorized, fetching periods...`,
    );

    // Get JWT token
    const jwtResponse = await captureHaulmerJWT({
      rut: haulmerConfig.rut,
      email: haulmerConfig.email,
      password: haulmerConfig.password,
    });

    const jwt = jwtResponse.jwtToken;

    // Fetch available periods in parallel and get counts
    const [salesResponse, purchasesResponse] = await Promise.all([
      fetch(
        `https://api-frontend.haulmer.com/v3/dte/core/registro/ventas/periodos/${haulmerConfig.rut}`,
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
            Origin: "https://espacio.haulmer.com",
            Referer: "https://espacio.haulmer.com/",
            ...(haulmerConfig.workspaceId && {
              workspace: haulmerConfig.workspaceId,
              resource: haulmerConfig.workspaceId,
            }),
          },
        },
      ).then((res) => res.json()),
      fetch(
        `https://api-frontend.haulmer.com/v3/dte/core/registro/compras/periodos/${haulmerConfig.rut}`,
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
            Origin: "https://espacio.haulmer.com",
            Referer: "https://espacio.haulmer.com/",
            ...(haulmerConfig.workspaceId && {
              workspace: haulmerConfig.workspaceId,
              resource: haulmerConfig.workspaceId,
            }),
          },
        },
      ).then((res) => res.json()),
    ]);

    // Parse sales periods
    const salesPeriods = (
      (salesResponse?.details as Array<{ periodo: number; emitidos: number }>) || []
    )
      .filter((item) => item.emitidos > 0)
      .map((item) => ({
        periodo: String(item.periodo),
        count: item.emitidos,
      }))
      .sort((a, b) => b.periodo.localeCompare(a.periodo));

    // Parse purchase periods
    const purchasePeriods = (
      (purchasesResponse?.details as Array<{ periodo: number; recibidos: number }>) || []
    )
      .filter((item) => item.recibidos > 0)
      .map((item) => ({
        periodo: String(item.periodo),
        count: item.recibidos,
      }))
      .sort((a, b) => b.periodo.localeCompare(a.periodo));

    console.log(
      `[Haulmer] GET /available-periods: Success (${salesPeriods.length} sales, ${purchasePeriods.length} purchases)`,
    );

    return reply(c, {
      status: "ok",
      sales: salesPeriods,
      purchases: purchasePeriods,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Haulmer] GET /available-periods: Error:", msg);
    return reply(c, { status: "error", message: msg }, 500);
  }
});

/**
 * POST /haulmer/sync
 * Trigger sync for specified periods and document types
 *
 * Body:
 * {
 *   periods: ["202601", "202602"],
 *   docTypes: ["sales", "purchases"]
 * }
 */
haulmerRoutes.post("/sync", async (c: Context) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Not authorized" }, 401);
  }

  const canSync = await hasPermission(user.id, "create", "Integration");
  if (!canSync) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  if (!haulmerConfig) {
    return reply(
      c,
      {
        status: "error",
        message: "Haulmer not configured (missing env vars)",
      },
      503,
    );
  }

  try {
    const body = await c.req.json();
    const { periods, docTypes } = body;

    if (!periods || !Array.isArray(periods) || periods.length === 0) {
      return reply(c, { status: "error", message: "periods required" }, 400);
    }

    if (!docTypes || !Array.isArray(docTypes) || docTypes.length === 0) {
      return reply(c, { status: "error", message: "docTypes required" }, 400);
    }

    console.log(`[Haulmer] Syncing ${periods.length} periods x ${docTypes.length} types`);

    const results = await syncPeriods({
      rut: haulmerConfig.rut,
      periods,
      docTypes,
      email: haulmerConfig.email,
      password: haulmerConfig.password,
    });

    return reply(c, {
      status: "ok",
      results,
      summary: {
        total: results.length,
        success: results.filter((r) => r.status === "success").length,
        failed: results.filter((r) => r.status === "failed").length,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Haulmer] Sync error:", msg);
    return reply(c, { status: "error", message: msg }, 500);
  }
});

/**
 * POST /haulmer/sync/incremental
 * Sync only new periods since latest successful sync (per docType)
 */
haulmerRoutes.post("/sync/incremental", async (c: Context) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Not authorized" }, 401);
  }

  const canSync = await hasPermission(user.id, "create", "Integration");
  if (!canSync) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  if (!haulmerConfig) {
    return reply(
      c,
      {
        status: "error",
        message: "Haulmer not configured (missing env vars)",
      },
      503,
    );
  }

  try {
    const body = incrementalSyncSchema.parse(await c.req.json());
    const docTypes: Array<"purchases" | "sales"> =
      body.docTypes && body.docTypes.length > 0 ? body.docTypes : ["sales", "purchases"];

    const jwtResponse = await captureHaulmerJWT({
      rut: haulmerConfig.rut,
      email: haulmerConfig.email,
      password: haulmerConfig.password,
    });

    const jwt = jwtResponse.jwtToken;
    const [salesResponse, purchasesResponse] = await Promise.all([
      fetch(
        `https://api-frontend.haulmer.com/v3/dte/core/registro/ventas/periodos/${haulmerConfig.rut}`,
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
            Origin: "https://espacio.haulmer.com",
            Referer: "https://espacio.haulmer.com/",
            ...(haulmerConfig.workspaceId && {
              workspace: haulmerConfig.workspaceId,
              resource: haulmerConfig.workspaceId,
            }),
          },
        },
      ).then((res) => res.json()),
      fetch(
        `https://api-frontend.haulmer.com/v3/dte/core/registro/compras/periodos/${haulmerConfig.rut}`,
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
            Origin: "https://espacio.haulmer.com",
            Referer: "https://espacio.haulmer.com/",
            ...(haulmerConfig.workspaceId && {
              workspace: haulmerConfig.workspaceId,
              resource: haulmerConfig.workspaceId,
            }),
          },
        },
      ).then((res) => res.json()),
    ]);

    const availableByDocType: Record<"purchases" | "sales", string[]> = {
      sales: uniqueSortedPeriodsDesc(
        ((salesResponse?.details as Array<{ emitidos: number; periodo: number }>) || [])
          .filter((item) => item.emitidos > 0)
          .map((item) => String(item.periodo)),
      ),
      purchases: uniqueSortedPeriodsDesc(
        ((purchasesResponse?.details as Array<{ periodo: number; recibidos: number }>) || [])
          .filter((item) => item.recibidos > 0)
          .map((item) => String(item.periodo)),
      ),
    };

    const successfulLogs = await db.haulmerSyncLog.findMany({
      where: {
        rut: haulmerConfig.rut,
        docType: { in: docTypes },
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
      if (item.docType !== "sales" && item.docType !== "purchases") {
        continue;
      }
      if (!latestSyncedByDocType.has(item.docType)) {
        latestSyncedByDocType.set(item.docType, item.period);
      }
    }

    const syncTasks: Array<{ docType: "purchases" | "sales"; period: string }> = [];
    for (const docType of docTypes) {
      const available = availableByDocType[docType];
      const latestSynced = latestSyncedByDocType.get(docType);
      const latestAvailable = available[0];

      for (const period of available) {
        const isNewPeriod = !latestSynced || period > latestSynced;
        const isLatestRefresh =
          body.includeLatestAlreadySynced && latestAvailable != null && period === latestAvailable;
        if (isNewPeriod || isLatestRefresh) {
          syncTasks.push({ period, docType });
        }
      }
    }

    if (syncTasks.length === 0) {
      return reply(c, {
        status: "ok",
        message: "No hay períodos nuevos para sincronizar",
        results: [],
        summary: {
          failed: 0,
          success: 0,
          total: 0,
        },
      });
    }

    const grouped = new Map<string, Set<"purchases" | "sales">>();
    for (const task of syncTasks) {
      const set = grouped.get(task.period) ?? new Set<"purchases" | "sales">();
      set.add(task.docType);
      grouped.set(task.period, set);
    }

    const periods = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a));
    const results = await syncPeriods({
      rut: haulmerConfig.rut,
      periods,
      docTypes,
      email: haulmerConfig.email,
      password: haulmerConfig.password,
    });

    const filteredResults = results.filter((result) =>
      grouped.get(result.period)?.has(result.docType),
    );

    return reply(c, {
      status: "ok",
      mode: "incremental",
      results: filteredResults,
      summary: {
        total: filteredResults.length,
        success: filteredResults.filter((r) => r.status === "success").length,
        failed: filteredResults.filter((r) => r.status === "failed").length,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Haulmer] Incremental sync error:", msg);
    return reply(c, { status: "error", message: msg }, 500);
  }
});

/**
 * GET /haulmer/sync-logs
 * List recent sync logs
 */
haulmerRoutes.get("/sync-logs", async (c: Context) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Not authorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "Integration");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const limit = Number(c.req.query("limit") ?? "50");
    const offset = Number(c.req.query("offset") ?? "0");

    const safeLimit = Number.isNaN(limit) ? 50 : Math.min(Math.max(limit, 1), 200);
    const safeOffset = Number.isNaN(offset) ? 0 : Math.max(offset, 0);

    // TODO: Replace with actual DB query when HaulmerSyncLog is available
    // const logs = await db.haulmerSyncLog.findMany({
    //   orderBy: { createdAt: 'desc' },
    //   take: safeLimit,
    //   skip: safeOffset,
    // });

    return reply(c, {
      status: "ok",
      logs: [],
      total: 0,
      limit: safeLimit,
      offset: safeOffset,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return reply(c, { status: "error", message: msg }, 500);
  }
});
