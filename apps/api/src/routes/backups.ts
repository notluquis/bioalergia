import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import {
  getCurrentJobs,
  getJobHistory,
  getLogs,
  startBackup,
} from "../services/backups";
import { streamSSE } from "hono/streaming";

const app = new Hono();

app.get("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  // Check for "read Backup" permission
  const canAccess = await hasPermission(user.id, "read", "Backup");
  if (!canAccess) {
    return c.json(
      {
        status: "error",
        message: "Forbidden - missing 'read Backup' permission",
      },
      403
    );
  }

  const jobs = getCurrentJobs();
  return c.json({ jobs, backups: [] });
});

app.post("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  // Check for "create Backup" permission
  const canCreate = await hasPermission(user.id, "create", "Backup");
  if (!canCreate) {
    return c.json(
      {
        status: "error",
        message: "Forbidden - missing 'create Backup' permission",
      },
      403
    );
  }

  const job = startBackup();
  return c.json({ message: "Backup started", job });
});

app.get("/logs", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canAccess = await hasPermission(user.id, "read", "Backup");
  if (!canAccess) {
    return c.json({ status: "error", message: "Forbidden" }, 403);
  }

  const logs = getLogs(100);
  return c.json({ logs });
});

app.get("/history", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canAccess = await hasPermission(user.id, "read", "Backup");
  if (!canAccess) {
    return c.json({ status: "error", message: "Forbidden" }, 403);
  }

  const history = getJobHistory();
  return c.json({ history });
});

// SSE for progress
app.get("/progress", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canAccess = await hasPermission(user.id, "read", "Backup");
  if (!canAccess) {
    return c.json({ status: "error", message: "Forbidden" }, 403);
  }

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      data: JSON.stringify({
        type: "init",
        jobs: getCurrentJobs(),
      }),
    });

    while (true) {
      await stream.sleep(5000);
      await stream.writeSSE({
        event: "ping",
        data: "keepalive",
      });
    }
  });
});

export default app;
