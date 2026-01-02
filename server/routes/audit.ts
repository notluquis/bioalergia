/**
 * Audit API Routes
 *
 * Endpoints for viewing audit logs and reverting changes.
 */

import express from "express";
import { asyncHandler, authenticate as requireAuth } from "../lib/http.js";
import { authorize } from "../middleware/authorize.js";
import { prisma } from "../prisma.js";
import {
  getRecentChanges,
  getChangesByTable,
  getRowHistory,
  getAuditStats,
  revertChange,
  getPendingChangesCount,
} from "../services/audit/index.js";
import { triggerIncrementalExport } from "../services/backup/scheduler.js";

const router = express.Router();

// All audit routes require auth and admin permissions
router.use(requireAuth);
router.use(authorize("update", "Setting"));

/**
 * Get audit statistics.
 */
router.get(
  "/stats",
  asyncHandler(async (_, res) => {
    const stats = await getAuditStats();
    const pendingExport = await getPendingChangesCount();
    res.json({ ...stats, pendingExport });
  })
);

/**
 * Get tables that have changes since a specific date (for restore UI).
 * If no 'since' param provided, returns all tables with any changes.
 */
router.get(
  "/tables-with-changes",
  asyncHandler(async (req, res) => {
    const since = req.query.since as string | undefined;

    if (since) {
      // Query tables with changes after the given date
      const result = await prisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT DISTINCT table_name 
        FROM audit.data_changes 
        WHERE created_at > ${new Date(since)}
      `;
      res.json({ tables: result.map((r) => r.table_name) });
    } else {
      // Return all tables with any changes
      const stats = await getAuditStats();
      const tablesWithChanges = stats.byTable.map((t) => t.table_name);
      res.json({ tables: tablesWithChanges });
    }
  })
);

/**
 * Get recent changes (paginated).
 */
router.get(
  "/changes",
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const changes = await getRecentChanges(limit, offset);

    // Convert BigInt to string for JSON
    const serialized = changes.map((c) => ({
      ...c,
      id: c.id.toString(),
      transaction_id: c.transaction_id.toString(),
    }));

    res.json({ changes: serialized, count: serialized.length });
  })
);

/**
 * Get changes for a specific table.
 */
router.get(
  "/changes/:table",
  asyncHandler(async (req, res) => {
    const { table } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
    const changes = await getChangesByTable(table, limit);

    const serialized = changes.map((c) => ({
      ...c,
      id: c.id.toString(),
      transaction_id: c.transaction_id.toString(),
    }));

    res.json({ changes: serialized, table });
  })
);

/**
 * Get history for a specific row.
 */
router.get(
  "/history/:table/:rowId",
  asyncHandler(async (req, res) => {
    const { table, rowId } = req.params;
    const changes = await getRowHistory(table, rowId);

    const serialized = changes.map((c) => ({
      ...c,
      id: c.id.toString(),
      transaction_id: c.transaction_id.toString(),
    }));

    res.json({ changes: serialized, table, rowId });
  })
);

/**
 * Revert a specific change.
 */
router.post(
  "/revert/:changeId",
  asyncHandler(async (req, res) => {
    const { changeId } = req.params;
    const result = await revertChange(BigInt(changeId));
    res.json(result);
  })
);

/**
 * Manually trigger incremental export.
 */
router.post(
  "/export",
  asyncHandler(async (_, res) => {
    const result = await triggerIncrementalExport();
    res.json(result);
  })
);

export default router;
