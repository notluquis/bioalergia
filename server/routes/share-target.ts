import express, { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), "uploads", "shared");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // Sanitize filename and add timestamp to prevent collisions
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, "_");
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// POST /share-target
// Handles files shared from other apps via PWA Share Target API
router.post("/", upload.array("media"), (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    const { title, text, url } = req.body;

    console.log("[ShareTarget] Received share:", { title, text, url, files: files?.length });

    if (!files || files.length === 0) {
      // If no files, just redirect to movements (maybe it was just text shared)
      return res.redirect(303, "/finanzas/movements");
    }

    // For now, we'll take the first file and pass it as a query param
    // In the future, we could handle multiple files
    const filename = files[0].filename;

    // Redirect to the app with the file info
    // The frontend should read this param and open the "New Transaction" modal
    res.redirect(303, `/finanzas/movements?shared_file=${filename}`);
  } catch (error) {
    console.error("[ShareTarget] Error processing share:", error);
    res.status(500).send("Error processing shared content");
  }
});

export default router;
