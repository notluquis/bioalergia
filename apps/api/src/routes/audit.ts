import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { getTablesWithChanges } from "../services/audit";

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
      500
    );
  }
});

export default app;
