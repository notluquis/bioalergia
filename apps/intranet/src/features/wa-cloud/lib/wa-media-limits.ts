// WhatsApp Cloud API media constraints (Meta Graph API v22+, 2026).
// Source: developers.facebook.com/docs/whatsapp/cloud-api/reference/media
//
// We classify each incoming file into a Meta `type` and verify the
// raw byte size + the mime against Meta's accepted list. Anything
// outside the matrix gets rejected client-side so we don't waste a
// round-trip on an upload that Meta would 400 anyway.

export type WaMediaType = "image" | "video" | "audio" | "document" | "sticker";

type Limit = {
  type: WaMediaType;
  // Hard byte cap enforced by Meta. Files at exactly the limit
  // sometimes 400 with "media file too large" so we conservatively
  // subtract 4KB of overhead per request.
  maxBytes: number;
  // Whitelisted mimes — strict match required.
  mimes: ReadonlySet<string>;
  // Extensions used to recover a type when the browser delivered
  // `file.type === ""` (Safari + some Android share intents).
  extensions: ReadonlySet<string>;
};

const KB = 1024;
const MB = 1024 * KB;

// Ordered list — first match wins. Sticker comes before image so a
// .webp doesn't get misclassified as a regular image.
const LIMITS: ReadonlyArray<Limit> = [
  {
    type: "sticker",
    maxBytes: 500 * KB - 4 * KB,
    mimes: new Set(["image/webp"]),
    extensions: new Set(["webp"]),
  },
  {
    type: "image",
    maxBytes: 5 * MB - 4 * KB,
    mimes: new Set(["image/jpeg", "image/jpg", "image/png"]),
    extensions: new Set(["jpg", "jpeg", "png"]),
  },
  {
    type: "audio",
    maxBytes: 16 * MB - 4 * KB,
    mimes: new Set([
      "audio/aac",
      "audio/mp4",
      "audio/mpeg",
      "audio/amr",
      "audio/ogg",
      "audio/opus",
    ]),
    extensions: new Set(["aac", "m4a", "mp3", "amr", "ogg", "opus"]),
  },
  {
    type: "video",
    maxBytes: 16 * MB - 4 * KB,
    mimes: new Set(["video/mp4", "video/3gpp"]),
    extensions: new Set(["mp4", "3gp", "3gpp"]),
  },
  {
    type: "document",
    maxBytes: 100 * MB - 4 * KB,
    mimes: new Set([
      "text/plain",
      "application/pdf",
      "application/vnd.ms-powerpoint",
      "application/msword",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]),
    extensions: new Set(["txt", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"]),
  },
];

// iOS Photos shares HEIC by default; Meta refuses. We could canvas-
// convert to JPEG but that doubles memory on a phone PWA — surface
// the error instead so the operator picks a different format.
const REJECTED_MIMES: ReadonlySet<string> = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);
const REJECTED_EXTENSIONS: ReadonlySet<string> = new Set(["heic", "heif"]);

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export type ClassifyResult =
  | { ok: true; type: WaMediaType; mime: string }
  | { ok: false; reason: string };

export function classifyFile(file: { name: string; type: string; size: number }): ClassifyResult {
  const ext = extOf(file.name);
  if (REJECTED_MIMES.has(file.type) || REJECTED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      reason: "HEIC/HEIF no soportado por WhatsApp. Convierte a JPEG antes de enviar.",
    };
  }
  for (const lim of LIMITS) {
    const mimeMatches = file.type && lim.mimes.has(file.type);
    const extMatches = !file.type && lim.extensions.has(ext);
    if (mimeMatches || extMatches) {
      if (file.size > lim.maxBytes) {
        return {
          ok: false,
          reason: `Tamaño ${(file.size / MB).toFixed(1)} MB excede el máximo de ${(
            lim.maxBytes / MB
          ).toFixed(0)} MB para ${lim.type}.`,
        };
      }
      // Re-derive mime when the browser sent empty so the upload
      // request carries a usable Content-Type.
      const mime =
        file.type ||
        (lim.type === "image"
          ? `image/${ext === "jpg" ? "jpeg" : ext}`
          : lim.type === "video"
            ? `video/${ext === "3gp" || ext === "3gpp" ? "3gpp" : "mp4"}`
            : `application/octet-stream`);
      return { ok: true, type: lim.type, mime };
    }
  }
  return {
    ok: false,
    reason: `Formato no soportado por WhatsApp${file.type ? ` (${file.type})` : ""}.`,
  };
}

// 1024-char hard cap per Meta. Combine title + text + url and trim.
export function buildSharedCaption(parts: { title: string; text: string; url: string }): string {
  const joined = [parts.title, parts.text, parts.url].filter(Boolean).join("\n").trim();
  if (joined.length <= 1024) return joined;
  return `${joined.slice(0, 1021)}...`;
}
