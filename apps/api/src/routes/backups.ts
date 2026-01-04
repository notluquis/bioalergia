/**
 * Backup Routes for Hono API
 *
 * Handles backup/restore operations with SSE progress streaming
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "";
const COOKIE_NAME = "finanzas_session";

export const backupRoutes = new Hono();

// Helper to get auth
function getAuth(c: { req: { header: (name: string) => string | undefined } }) {
  const cookieHeader = c.req.header("Cookie");
  if (!cookieHeader) return null;
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => c.trim().split("=")),
  );
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    return { userId: Number(decoded.sub), email: String(decoded.email) };
  } catch {
    return null;
  }
}

// Placeholder for backup service - will be implemented when service is ported
const backupService = {
  getBackups: async () => [],
  startBackup: async () => ({ id: `backup-${Date.now()}`, status: "started" }),
  getBackupDetails: async (_fileId: string) => null,
  getBackupTables: async (_fileId: string) => [],
  startRestore: async (_fileId: string, _tables?: string[]) => ({
    id: `restore-${Date.now()}`,
    status: "started",
  }),
  getLogs: async (_limit: number) => [],
  getCurrentJobs: () => [],
  getJobHistory: () => [],
};

// ============================================================
// SSE PROGRESS STREAM
// ============================================================

backupRoutes.get("/progress", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  return streamSSE(c, async (stream) => {
    const logs = await backupService.getLogs(50);
    await stream.writeSSE({
      data: JSON.stringify({
        type: "init",
        jobs: backupService.getCurrentJobs(),
        logs,
      }),
    });

    // In a full implementation, we'd subscribe to progress updates here
    // For now, just keep connection alive
    const interval = setInterval(async () => {
      await stream.writeSSE({ data: JSON.stringify({ type: "heartbeat" }) });
    }, 30000);

    stream.onAbort(() => clearInterval(interval));
  });
});

// ============================================================
// BACKUP CRUD
// ============================================================

backupRoutes.get("/", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const backups = await backupService.getBackups();
  return c.json({ backups });
});

backupRoutes.post("/", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const job = await backupService.startBackup();
  console.log("[Backup] Started by", auth.email);
  return c.json({ message: "Backup started", job });
});

backupRoutes.get("/status", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  return c.json(backupService.getCurrentJobs());
});

backupRoutes.get("/history", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  return c.json({ history: backupService.getJobHistory() });
});

backupRoutes.get("/logs", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const limit = Math.min(parseInt(c.req.query("limit") || "100", 10), 500);
  const logs = await backupService.getLogs(limit);
  return c.json({ logs });
});

backupRoutes.get("/:fileId", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const backup = await backupService.getBackupDetails(c.req.param("fileId"));
  if (!backup) return c.json({ error: "Backup not found" }, 404);
  return c.json({ backup });
});

backupRoutes.get("/:fileId/tables", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const tables = await backupService.getBackupTables(c.req.param("fileId"));
  return c.json({ tables });
});

backupRoutes.post("/:fileId/restore", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const { tables } = await c.req.json<{ tables?: string[] }>();
  const job = await backupService.startRestore(c.req.param("fileId"), tables);
  console.log("[Backup] Restore started by", auth.email);
  return c.json({ message: "Restore started", job });
});
