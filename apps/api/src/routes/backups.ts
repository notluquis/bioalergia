import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import { getSessionUser, hasPermission } from "../auth";
import { isOAuthConfigured } from "../lib/google/google-core";
import {
  createBackup,
  getCurrentJobs,
  getJobHistory,
  getLogs,
  startBackup,
} from "../services/backups";
import {
  BackupFile,
  downloadFromDrive,
  getBackupInfo,
  getBackupTables,
  listBackups,
  uploadToDrive,
} from "../services/drive";

const app = new Hono();

// List all backups from Google Drive
app.get("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

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

  try {
    // Check if OAuth is configured
    if (!isOAuthConfigured()) {
      return c.json({
        status: "ok",
        jobs: getCurrentJobs(),
        backups: [],
        warning:
          "Google Drive no configurado. Configura las credenciales OAuth para ver backups.",
      });
    }

    const backups = await listBackups();
    const jobs = getCurrentJobs();

    return c.json({ status: "ok", jobs, backups });
  } catch (error) {
    console.error("[Backups] Error listing backups:", error);
    return c.json({
      status: "ok",
      jobs: getCurrentJobs(),
      backups: [],
      error:
        error instanceof Error
          ? error.message
          : "Error al conectar con Google Drive",
    });
  }
});

// Create a new backup
app.post("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

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

  try {
    const job = startBackup();
    return c.json({ status: "ok", message: "Backup started", job });
  } catch (error) {
    return c.json(
      {
        status: "error",
        message:
          error instanceof Error ? error.message : "Error starting backup",
      },
      500
    );
  }
});

// Get tables from a specific backup
app.get("/:fileId/tables", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canAccess = await hasPermission(user.id, "read", "Backup");
  if (!canAccess) {
    return c.json({ status: "error", message: "Forbidden" }, 403);
  }

  const fileId = c.req.param("fileId");

  try {
    const tables = await getBackupTables(fileId);
    return c.json({ status: "ok", tables });
  } catch (error) {
    console.error("[Backups] Error getting tables:", error);
    return c.json(
      {
        status: "error",
        message:
          error instanceof Error ? error.message : "Error al obtener tablas",
      },
      500
    );
  }
});

// Get backup logs
app.get("/logs", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canAccess = await hasPermission(user.id, "read", "Backup");
  if (!canAccess) {
    return c.json({ status: "error", message: "Forbidden" }, 403);
  }

  const logs = getLogs(100);
  return c.json({ status: "ok", logs });
});

// Get backup history
app.get("/history", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canAccess = await hasPermission(user.id, "read", "Backup");
  if (!canAccess) {
    return c.json({ status: "error", message: "Forbidden" }, 403);
  }

  const history = getJobHistory();
  return c.json({ status: "ok", history });
});

// Restore from backup
app.post("/:fileId/restore", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canRestore = await hasPermission(user.id, "update", "Backup");
  if (!canRestore) {
    return c.json(
      {
        status: "error",
        message: "Forbidden - missing 'update Backup' permission",
      },
      403
    );
  }

  const fileId = c.req.param("fileId");
  const body = await c.req.json().catch(() => ({}));
  const tables = body.tables as string[] | undefined;

  try {
    // TODO: Implement restore logic
    // This would download the file, decompress, and restore selected tables
    return c.json({
      status: "ok",
      job: {
        id: `restore-${Date.now()}`,
        status: "pending",
        backupFileId: fileId,
        tables,
      },
    });
  } catch (error) {
    return c.json(
      {
        status: "error",
        message:
          error instanceof Error ? error.message : "Error starting restore",
      },
      500
    );
  }
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
    // Initial state
    await stream.writeSSE({
      data: JSON.stringify({
        type: "init",
        jobs: { backup: null, restore: null },
      }),
    });

    // Keepalive
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
