import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import {
  getTablesWithChanges,
  revertAuditChange,
  exportAuditLogs,
} from "../services/audit";

const app = new Hono();

// GET /tables-with-changes?since=ISOString
app.get("/tables-with-changes", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  // Read permission for Backup implies reading what needs backup
  const canAccess = await hasPermission(user.id, "read", "Backup");
  if (!canAccess) {
    return c.json({ status: "error", message: "Forbidden" }, 403);
  }

  const sinceQuery = c.req.query("since");
  const since = sinceQuery ? new Date(sinceQuery) : undefined;

  if (since && isNaN(since.getTime())) {
    return c.json({ status: "error", message: "Invalid date format" }, 400);
  }

  try {
    const tables = await getTablesWithChanges(since);
    return c.json({ status: "ok", tables });
  } catch (error) {
    console.error("[Audit] Error getting tables with changes:", error);
    return c.json(
      { status: "error", message: "Error fetching incremental changes" },
      500,
    );
  }
});

// POST /revert/:changeId - Revert a specific change
app.post("/revert/:changeId", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canRevert = await hasPermission(user.id, "delete", "Backup");
  if (!canRevert) {
    return c.json({ status: "error", message: "Forbidden" }, 403);
  }

  const changeId = c.req.param("changeId");
  if (!changeId) {
    return c.json({ status: "error", message: "Change ID required" }, 400);
  }

  try {
    const result = await revertAuditChange(BigInt(changeId), user.id);
    return c.json(result);
  } catch (error) {
    console.error("[Audit] Error reverting change:", error);
    return c.json(
      {
        status: "error",
        success: false,
        message:
          error instanceof Error ? error.message : "Error al revertir cambio",
      },
      500,
    );
  }
});

// POST /export - Export audit logs to backup
app.post("/export", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canExport = await hasPermission(user.id, "create", "Backup");
  if (!canExport) {
    return c.json({ status: "error", message: "Forbidden" }, 403);
  }

  try {
    const result = await exportAuditLogs();
    return c.json(result);
  } catch (error) {
    console.error("[Audit] Error exporting logs:", error);
    return c.json(
      {
        status: "error",
        success: false,
        message: "Error al exportar logs",
      },
      500,
    );
  }
});

export default app;
