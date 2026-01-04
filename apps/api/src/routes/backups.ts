import { Hono } from "hono";
import { getSessionUser } from "../auth";
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

  const hasAdminRole = user.roles.some(
    (r) => r.role.name === "ADMIN" || r.role.name === "SUPERADMIN"
  );
  if (!hasAdminRole) {
    return c.json({ status: "error", message: "Forbidden" }, 403);
  }

  const jobs = getCurrentJobs();
  return c.json({ jobs });
});

app.post("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const job = startBackup();
  return c.json({ message: "Backup started", job });
});

app.get("/logs", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const logs = getLogs(100);
  return c.json({ logs });
});

app.get("/history", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const history = getJobHistory();
  return c.json({ history });
});

// SSE for progress
app.get("/progress", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  return streamSSE(c, async (stream) => {
    // Initial state
    await stream.writeSSE({
      data: JSON.stringify({
        type: "init",
        jobs: getCurrentJobs(),
      }),
    });

    // In a real implementation, we'd subscribe to an event emitter here
    // For now, client polls or we push updates if we had a global emitter
    // Keeping it simple: minimal keepalive
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
