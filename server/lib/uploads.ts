import fs from "fs";
import path from "path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsRoot = process.env.UPLOADS_ROOT_DIR
  ? path.resolve(process.env.UPLOADS_ROOT_DIR)
  : path.resolve(__dirname, "../uploads");
const brandingUploadsDir = path.join(uploadsRoot, "branding");

export const BRANDING_LOGO_MAX_WIDTH = 1600;
export const BRANDING_LOGO_MAX_HEIGHT = 1600;
export const BRANDING_LOGO_MAX_FILE_SIZE = 12 * 1024 * 1024; // 12MB

const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"]);
const allowedMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
]);

export function ensureUploadStructure() {
  fs.mkdirSync(brandingUploadsDir, { recursive: true });
}

export function isSupportedImageType(originalname: string, mimetype: string | undefined) {
  if (mimetype && allowedMimeTypes.has(mimetype)) {
    return true;
  }
  const ext = path.extname(originalname).toLowerCase();
  return allowedExtensions.has(ext);
}

/**
 * Converts the incoming filename into a filesystem-safe slug by lowercasing,
 * replacing non-alphanumeric characters with dashes and trimming separators.
 * Falls back to "logo" when no meaningful characters remain.
 */
function slugifyName(original: string) {
  const base = path.basename(original, path.extname(original));
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length ? slug : "logo";
}

function generateFilename(original: string, forcedExt?: string) {
  const ext = forcedExt ?? (path.extname(original).toLowerCase() || ".png");
  const slug = slugifyName(original);
  const suffix = randomBytes(4).toString("hex");
  return `${slug}-${Date.now()}-${suffix}${ext}`;
}

export async function saveBrandingLogoFile(buffer: Buffer, originalname: string) {
  ensureUploadStructure();
  const ext = path.extname(originalname).toLowerCase();
  const isVector = ext === ".svg";

  const processedBuffer = isVector
    ? buffer
    : await sharp(buffer)
        .resize({
          width: BRANDING_LOGO_MAX_WIDTH,
          height: BRANDING_LOGO_MAX_HEIGHT,
          fit: "inside",
          withoutEnlargement: true,
        })
        .toFormat("webp", { quality: 92, effort: 4 })
        .toBuffer();

  const targetExt = isVector ? ext || ".svg" : ".webp";
  const filename = generateFilename(originalname, targetExt);
  const targetPath = path.join(brandingUploadsDir, filename);
  fs.writeFileSync(targetPath, processedBuffer);
  return {
    filename,
    relativeUrl: `/uploads/branding/${filename}`,
    absolutePath: targetPath,
  };
}

export function getUploadsRootDir() {
  ensureUploadStructure();
  return uploadsRoot;
}
