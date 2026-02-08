/**
 * Haulmer Integration Routes
 * Sync CSV downloads from Haulmer DTE registry
 */

import { type Context, Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { haulmerConfig } from "../config";
import { captureHaulmerJWT } from "../modules/haulmer/auth";
import {
  fetchAvailablePurchasePeriods,
  fetchAvailableSalesPeriods,
} from "../modules/haulmer/downloader";
import { syncPeriods } from "../modules/haulmer/service";
import { reply } from "../utils/reply";

export const haulmerRoutes = new Hono();

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

    // Fetch available periods in parallel
    const [salesPeriods, purchasePeriods] = await Promise.all([
      fetchAvailableSalesPeriods(haulmerConfig.rut, jwt, haulmerConfig.workspaceId),
      fetchAvailablePurchasePeriods(haulmerConfig.rut, jwt, haulmerConfig.workspaceId),
    ]);

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
