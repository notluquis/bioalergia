import express from "express";
import multer from "multer";
import { asyncHandler, authenticate, requireRole } from "../lib/http.js";
import { logEvent, logWarn, requestContext } from "../lib/logger.js";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type AppSettings } from "../db.js";
import type { AuthenticatedRequest } from "../types.js";
import { settingsSchema } from "../schemas.js";
import {
  BRANDING_LOGO_MAX_FILE_SIZE,
  isSupportedImageType,
  saveBrandingLogoFile,
  saveBrandingFaviconFile,
} from "../lib/uploads.js";

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
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const settings = await loadSettings();
      logEvent("settings:get", requestContext(req));
      res.json({ status: "ok", settings });
    })
  );

  app.put(
    "/api/settings",
    authenticate,
    requireRole("GOD", "ADMIN"),
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
      await saveSettings(payload);
      const settings = await loadSettings();
      logEvent("settings:update:success", requestContext(req));
      res.json({ status: "ok", settings });
    })
  );

  app.post(
    "/api/settings/logo/upload",
    authenticate,
    requireRole("GOD", "ADMIN"),
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
    requireRole("GOD", "ADMIN"),
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
