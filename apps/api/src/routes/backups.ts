import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { isOAuthConfigured } from "../lib/google/google-core";
import { zValidator } from "../lib/zod-validator";
import { getCurrentJobs, getJobHistory, getLogs, startBackup } from "../services/backups";
import { getBackupTables, listBackups } from "../services/drive";
import { reply } from "../utils/reply";

const restoreSchema = z.object({
  tables: z.array(z.string()).optional(),
});

const app = new Hono();

// List all backups from Google Drive
app.get("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canAccess = await hasPermission(user.id, "read", "Backup");
  if (!canAccess) {
    return reply(
      c,
      {
        status: "error",
        message: "Forbidden - missing 'read Backup' permission",
      },
      403,
    );
  }

  try {
    // Check if OAuth is configured
    if (!(await isOAuthConfigured())) {
      return reply(c, {
        status: "ok",
        jobs: getCurrentJobs(),
        backups: [],
        warning: "Google Drive no configurado. Configura las credenciales OAuth para ver backups.",
      });
    }

    const backups = await listBackups();
    const jobs = getCurrentJobs();

    return reply(c, { status: "ok", jobs, backups });
  } catch (error) {
    console.error("[Backups] Error listing backups:", error);
    return reply(c, {
      status: "ok",
      jobs: getCurrentJobs(),
      backups: [],
      error: error instanceof Error ? error.message : "Error al conectar con Google Drive",
    });
  }
});

// Create a new backup
app.post("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canCreate = await hasPermission(user.id, "create", "Backup");
  if (!canCreate) {
    return reply(
      c,
      {
        status: "error",
        message: "Forbidden - missing 'create Backup' permission",
      },
      403,
    );
  }

  try {
    const job = startBackup();
    return reply(c, { status: "ok", message: "Backup started", job });
  } catch (error) {
    return reply(
      c,
      {
        status: "error",
        message: error instanceof Error ? error.message : "Error starting backup",
      },
      500,
    );
  }
});

// Get tables from a specific backup
app.get("/:fileId/tables", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canAccess = await hasPermission(user.id, "read", "Backup");
  if (!canAccess) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const fileId = c.req.param("fileId");

  try {
    const tables = await getBackupTables(fileId);
    return reply(c, { status: "ok", tables });
  } catch (error) {
    console.error("[Backups] Error getting tables:", error);
    return reply(
      c,
      {
        status: "error",
        message: error instanceof Error ? error.message : "Error al obtener tablas",
      },
      500,
    );
  }
});

// Get backup logs
app.get("/logs", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canAccess = await hasPermission(user.id, "read", "Backup");
  if (!canAccess) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const logs = getLogs(100);
  return reply(c, { status: "ok", logs });
});

// Get backup history
app.get("/history", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canAccess = await hasPermission(user.id, "read", "Backup");
  if (!canAccess) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const history = getJobHistory();
  return reply(c, { status: "ok", history });
});

// Restore from backup
app.post("/:fileId/restore", zValidator("json", restoreSchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRestore = await hasPermission(user.id, "update", "Backup");
  if (!canRestore) {
    return reply(
      c,
      {
        status: "error",
        message: "Forbidden - missing 'update Backup' permission",
      },
      403,
    );
  }

  const fileId = c.req.param("fileId");
  const { tables } = c.req.valid("json");

  try {
    const now = new Date();
    const job = {
      id: `restore-${Date.now()}`,
      status: "pending" as const,
      backupFileId: fileId,
      currentStep: "Initializing restore...",
      startedAt: now,
      progress: 0,
      tables,
    };
    // TODO: Implement restore logic
    // This would download the file, decompress, and restore selected tables
    return reply(c, {
      status: "ok",
      job,
    });
  } catch (error) {
    return reply(
      c,
      {
        status: "error",
        message: error instanceof Error ? error.message : "Error starting restore",
      },
      500,
    );
  }
});

// SSE for progress
app.get("/progress", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canAccess = await hasPermission(user.id, "read", "Backup");
  if (!canAccess) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  return streamSSE(c, async (stream) => {
    // Initial state
    await stream.writeSSE({
      data: JSON.stringify({
        type: "init",
        jobs: { backup: null, restore: null },
      }),
    });

    // Keepalive and Progress Loop
    for (;;) {
      const activeJobs = getCurrentJobs();

      for (const job of activeJobs) {
        await stream.writeSSE({
          data: JSON.stringify({
            type: job.type, // 'backup' or 'restore'
            job,
          }),
        });
      }

      await stream.sleep(1000); // Poll every second for smooth UI

      // Optional keepalive if needed by load balancers, but data events serve same purpose
      // await stream.writeSSE({ event: "ping", data: "keepalive" });
    }
  });
});

export default app;
