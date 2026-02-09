/**
 * DTE Synchronization Routes
 * Endpoints for DTE sync history and manual sync trigger
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { type Context, Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { getDTESyncHistory, syncDTEs } from "../services/dte-sync";
import { reply } from "../utils/reply";

export const dteRoutes = new Hono();

/**
 * GET /dte/sync-history
 * Get DTE synchronization history with pagination
 */
dteRoutes.get("/sync-history", async (c: Context) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "DTESyncLog");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const limit = Number(c.req.query("limit")) || 20;
    const offset = Number(c.req.query("offset")) || 0;

    const { logs, total } = await getDTESyncHistory(limit, offset);

    return reply(c, {
      status: "success",
      data: {
        logs: logs.map((log) => ({
          id: log.id,
          period: log.period,
          docTypes: log.docTypes,
          status: log.status,
          totalProcessed: log.totalProcessed,
          totalInserted: log.totalInserted,
          totalUpdated: log.totalUpdated,
          totalSkipped: log.totalSkipped,
          salesInserted: log.salesInserted,
          purchasesInserted: log.purchasesInserted,
          errorMessage: log.errorMessage,
          triggerSource: log.triggerSource,
          startedAt: log.startedAt,
          completedAt: log.completedAt,
        })),
        pagination: {
          limit,
          offset,
          total,
        },
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[DTE Routes] Error fetching sync history:", msg);
    return reply(c, { status: "error", message: "Failed to retrieve sync history" }, 500);
  }
});

/**
 * POST /dte/sync
 * Trigger manual DTE synchronization for a period
 *
 * Body:
 * {
 *   period: "202602",
 *   docTypes: ["sales", "purchases"]
 * }
 */
dteRoutes.post("/sync", async (c: Context) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canCreate = await hasPermission(user.id, "create", "DTESyncLog");
  if (!canCreate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const body = await c.req.json<{
      period?: string;
      docTypes?: ("sales" | "purchases")[];
    }>();

    const { period, docTypes } = body;

    console.log(`[DTE Routes] Manual sync triggered by user ${user.id}`);
    console.log(
      `[DTE Routes] Period: ${period || "last month"}, DocTypes: ${docTypes?.join(", ") || "all"}`,
    );

    const result = await syncDTEs({
      period,
      docTypes,
      triggerSource: "user",
      triggerUserId: String(user.id),
    });

    return reply(c, {
      status: "success",
      data: result,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[DTE Routes] Error triggering sync:", msg);
    return reply(c, { status: "error", message: "Failed to trigger sync" }, 500);
  }
});
