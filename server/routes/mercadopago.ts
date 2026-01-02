import { Router } from "express";
import { z } from "zod";
import * as MPService from "../services/mercadopago.js";
import { logger } from "../lib/logger.js";
import { AuthenticatedRequest } from "../types.js";

const router = Router();

// --- Zod Schemas ---

// --- Zod schemas for Actions ---

const CreateReportSchema = z.object({
  begin_date: z.string(), // ISO String expected e.g. "2023-01-01T00:00:00Z"
  end_date: z.string(),
});

const FrequencySchema = z.object({
  type: z.enum(["daily", "weekly", "monthly"]),
  value: z.number().int().min(1),
  hour: z.number().int().min(0).max(23),
});

const ColumnSchema = z.object({
  key: z.string().min(1),
});

const SftpInfoSchema = z
  .object({
    server: z.string().optional(),
    password: z.string().optional(),
    remote_dir: z.string().optional(),
    port: z.number().optional(),
    username: z.string().optional(),
  })
  .optional();

const ConfigSchema = z.object({
  file_name_prefix: z.string().min(1),
  columns: z.array(ColumnSchema).min(1),
  frequency: FrequencySchema,
  sftp_info: SftpInfoSchema,
  separator: z.string().optional(),
  display_timezone: z.string().optional(),
  report_translation: z.string().optional(),
  notification_email_list: z.array(z.string().email().or(z.null())).optional(),
  include_withdrawal_at_end: z.boolean().optional(),
  check_available_balance: z.boolean().optional(),
  compensate_detail: z.boolean().optional(),
  execute_after_withdrawal: z.boolean().optional(),
});

// --- Middleware ---

import { NextFunction, Response } from "express";

const checkPermissions = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Assuming 'manage' 'Setting' is the appropriate permission for MP config
  if (req.ability?.cannot("manage", "Setting")) {
    res.status(403).json({ error: "Forbidden", message: "No tienes permisos para configurar Mercado Pago" });
    return;
  }
  next();
};

router.use(checkPermissions);

// --- Routes ---

router.get("/config", async (_req, res, next) => {
  try {
    const config = await MPService.getReportConfig();
    res.json(config);
  } catch (error) {
    next(error);
  }
});

router.post("/config", async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const data = ConfigSchema.parse(req.body);
    const config = await MPService.createReportConfig(data);
    logger.info({ event: "mp_config_created", user: authReq.user?.email });
    res.status(201).json(config);
  } catch (error) {
    next(error);
  }
});

router.put("/config", async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const data = ConfigSchema.parse(req.body);
    const config = await MPService.updateReportConfig(data);
    logger.info({ event: "mp_config_updated", user: authReq.user?.email });
    res.json(config);
  } catch (error) {
    next(error);
  }
});

router.post("/reports", async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { begin_date, end_date } = CreateReportSchema.parse(req.body);
    const result = await MPService.createReport(begin_date, end_date);
    logger.info({ event: "mp_report_triggered", user: authReq.user?.email });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/reports", async (_req, res, next) => {
  try {
    const reports = await MPService.listReports();
    res.json(reports);
  } catch (error) {
    next(error);
  }
});

router.get("/reports/:id", async (req, res, next) => {
  try {
    // If id looks like a filename (contains .csv or .xlsx), treat as download
    // This is a bit ambiguous in REST, better to have explicit download route
    // But keeping exact matches first.
    // The user docs show /account/release_report/{file_name} for download
    // and /account/release_report/list for list.
    // Our route path is /reports/:id.
    const id = req.params.id;
    if (id.includes(".") || id.includes("report-")) {
      // heuristic for filename
      // Actually, let's use a specific route for download to be safe
      return next(); // Pass to next handler if not numeric ID??
    }
    const report = await MPService.getReport(id);
    res.json(report);
  } catch (error) {
    next(error);
  }
});

router.get("/reports/download/:fileName", async (req, res, next) => {
  try {
    const fileName = req.params.fileName;
    const fileResponse = await MPService.downloadReport(fileName);

    // Pipe the response
    res.setHeader("Content-Type", fileResponse.headers.get("Content-Type") || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    // Node 20+ fetch body is a ReadableStream, we need to convert to Node stream or consume
    // @ts-ignore - ReadableStream/Node stream mismatch typing common in Express+Fetch
    const reader = fileResponse.body?.getReader();
    if (!reader) {
      throw new Error("Failed to read file stream");
    }

    // Manual streaming
    const streamRead = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    };
    await streamRead();
  } catch (error) {
    next(error);
  }
});

router.post("/schedule", async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const result = await MPService.enableSchedule();
    logger.info({ event: "mp_schedule_enabled", user: authReq.user?.email });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ... (previous code)

router.delete("/schedule", async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const result = await MPService.disableSchedule();
    logger.info({ event: "mp_schedule_disabled", user: authReq.user?.email });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
