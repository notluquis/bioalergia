import express from "express";
import multer from "multer";
import { asyncHandler, authenticate, softAuthenticate } from "../lib/http.js";
import { authorize } from "../middleware/authorize.js";
import { logEvent, logWarn, requestContext } from "../lib/logger.js";
import { getSettings, updateSettings, getSetting, updateSetting, deleteSetting } from "../services/settings.js";
import { DEFAULT_SETTINGS, type AppSettings } from "../lib/settings.js";
import type { AuthenticatedRequest } from "../types.js";
import { settingsSchema } from "../schemas.js";
import {
  BRANDING_LOGO_MAX_FILE_SIZE,
  isSupportedImageType,
  saveBrandingLogoFile,
  saveBrandingFaviconFile,
} from "../lib/uploads.js";
import { logAudit } from "../services/audit.js";

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: BRANDING_LOGO_MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (isSupportedImageType(file.originalname, file.mimetype)) {
      cb(null, true);
    } else {
      const error = new multer.MulterError("LIMIT_UNEXPECTED_FILE", "logo");
      error.message = "El archivo debe ser una imagen PNG, JPG, WEBP, GIF, SVG o ICO";
      cb(error);
    }
  },
});

const faviconUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: BRANDING_LOGO_MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (isSupportedImageType(file.originalname, file.mimetype)) {
      cb(null, true);
    } else {
      const error = new multer.MulterError("LIMIT_UNEXPECTED_FILE", "favicon");
      error.message = "El archivo debe ser una imagen PNG, JPG, WEBP, GIF, SVG o ICO";
      cb(error);
    }
  },
});

export function registerSettingsRoutes(app: express.Express) {
  app.get(
    "/api/settings",
    softAuthenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const settings = await getSettings();
      logEvent("settings:get", requestContext(req));
      res.json({ status: "ok", settings });
    })
  );

  // Internal settings (admin only) — use prefix 'bioalergia_x.' for keys
  app.get(
    "/api/settings/internal",
    authenticate,
    authorize("update", "Setting"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const upsertChunk = await getSetting("bioalergia_x.upsert_chunk_size");
      // Expose both DB value and effective value (env var overrides DB). Do not expose other secrets.
      const envVal = process.env.BIOALERGIA_X_UPSERT_CHUNK_SIZE ?? null;
      const effective = envVal ?? upsertChunk ?? null;
      res.json({
        status: "ok",
        internal: { upsertChunkSize: upsertChunk, envUpsertChunkSize: envVal, effectiveUpsertChunkSize: effective },
      });
    })
  );

  app.put(
    "/api/settings/internal",
    authenticate,
    authorize("manage", "Setting"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { upsertChunkSize } = req.body ?? {};
      if (upsertChunkSize == null) {
        // remove key
        await deleteSetting("bioalergia_x.upsert_chunk_size");
        return res.json({ status: "ok", message: "Internal setting removed" });
      }
      const parsed = Number(upsertChunkSize);
      if (Number.isNaN(parsed) || parsed <= 0 || parsed > 5000) {
        return res.status(400).json({ status: "error", message: "Valor inválido para upsertChunkSize (1-5000)" });
      }
      await updateSetting("bioalergia_x.upsert_chunk_size", String(Math.max(50, Math.min(parsed, 5000))));
      res.json({ status: "ok" });
    })
  );

  app.put(
    "/api/settings",
    authenticate,
    authorize("manage", "Setting"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      logEvent("settings:update:attempt", requestContext(req, { body: req.body }));
      const parsed = settingsSchema.safeParse(req.body);
      if (!parsed.success) {
        logWarn("settings:update:invalid", requestContext(req, { issues: parsed.error.issues }));
        return res
          .status(400)
          .json({ status: "error", message: "Los datos no son válidos", issues: parsed.error.issues });
      }

      const payload: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...parsed.data,
      };
      await updateSettings(payload);
      const settings = await getSettings();
      logEvent("settings:update:success", requestContext(req));

      await logAudit({
        userId: req.auth!.userId,
        action: "SETTINGS_UPDATE",
        entity: "Settings",
        details: payload,
        ipAddress: req.ip,
      });

      res.json({ status: "ok", settings });
    })
  );

  app.post(
    "/api/settings/logo/upload",
    authenticate,
    authorize("manage", "Setting"),
    logoUpload.single("logo"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      if (!req.file) {
        return res.status(400).json({ status: "error", message: "Selecciona un archivo de imagen" });
      }
      const saved = await saveBrandingLogoFile(req.file.buffer, req.file.originalname);
      logEvent("settings:logo:upload", requestContext(req, { filename: saved.filename }));
      res.json({ status: "ok", url: saved.relativeUrl, filename: saved.filename });
    })
  );

  app.post(
    "/api/settings/favicon/upload",
    authenticate,
    authorize("manage", "Setting"),
    faviconUpload.single("favicon"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      if (!req.file) {
        return res.status(400).json({ status: "error", message: "Selecciona un archivo de imagen" });
      }
      const saved = await saveBrandingFaviconFile(req.file.buffer, req.file.originalname);
      logEvent("settings:favicon:upload", requestContext(req, { filename: saved.filename }));
      res.json({ status: "ok", url: saved.relativeUrl, filename: saved.filename });
    })
  );
}
