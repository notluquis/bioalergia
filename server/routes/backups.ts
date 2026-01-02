import express from "express";
import { asyncHandler, authenticate as requireAuth } from "../lib/http.js";
import { authorize } from "../middleware/authorize.js";
import {
  startBackup,
  startRestore,
  getCurrentJobs,
  getJobHistory,
  getBackups,
  getBackupDetails,
  getBackupTables,
  subscribeToProgress,
  getLogs,
} from "../services/backup/manager.js";

const router = express.Router();

// All backup routes require auth and admin permissions
router.use(requireAuth);
router.use(authorize("update", "Setting")); // Reuse setting permission for backups

// ==================== SSE PROGRESS STREAM ====================

/**
 * Server-Sent Events endpoint for real-time progress updates.
 * Client connects and receives progress updates as JSON events.
 */
router.get(
  "/progress",
  asyncHandler(async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

    // Send initial state with jobs and recent logs
    const logs = await getLogs(50);
    res.write(
      `data: ${JSON.stringify({
        type: "init",
        jobs: getCurrentJobs(),
        logs,
      })}\n\n`
    );

    // Subscribe to updates
    const sendEvent = (data: string) => {
      res.write(`data: ${data}\n\n`);
    };

    const unsubscribe = subscribeToProgress(sendEvent);

    // Cleanup on close
    req.on("close", () => {
      unsubscribe();
    });
  })
);

// ==================== LOGS ====================

/**
 * Get recent logs.
 */
router.get(
  "/logs",
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);
    res.json({ logs: await getLogs(limit) });
  })
);

// ==================== BACKUP OPERATIONS ====================

/**
 * List all backups in Google Drive.
 */
router.get(
  "/",
  asyncHandler(async (_, res) => {
    const backups = await getBackups();
    res.json({ backups });
  })
);

/**
 * Get current job status.
 */
router.get(
  "/status",
  asyncHandler(async (_, res) => {
    res.json(getCurrentJobs());
  })
);

/**
 * Get job history.
 */
router.get(
  "/history",
  asyncHandler(async (_, res) => {
    res.json({ history: getJobHistory() });
  })
);

/**
 * Start a new backup.
 */
router.post(
  "/",
  asyncHandler(async (_, res) => {
    const job = await startBackup();
    res.json({ message: "Backup started", job });
  })
);

/**
 * Get details of a specific backup.
 */
router.get(
  "/:fileId",
  asyncHandler(async (req, res) => {
    const { fileId } = req.params;
    const backup = await getBackupDetails(fileId);

    if (!backup) {
      return res.status(404).json({ error: "Backup not found" });
    }

    res.json({ backup });
  })
);

/**
 * Get tables contained in a backup (for granular restore).
 */
router.get(
  "/:fileId/tables",
  asyncHandler(async (req, res) => {
    const { fileId } = req.params;
    const tables = await getBackupTables(fileId);
    res.json({ tables });
  })
);

// ==================== RESTORE OPERATIONS ====================

/**
 * Start a restore from a backup.
 * Body: { tables?: string[] } - optional array of table names for granular restore
 */
router.post(
  "/:fileId/restore",
  asyncHandler(async (req, res) => {
    const { fileId } = req.params;
    const { tables } = req.body as { tables?: string[] };

    const job = await startRestore(fileId, tables);
    res.json({ message: "Restore started", job });
  })
);

export default router;
