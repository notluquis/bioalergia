// Cloudflare R2 (S3-compatible) presigned PUT para upload directo desde el
// browser. Las imágenes de producto son públicas (no PHI) — servimos via
// CDN URL (custom domain o pub-<hash>.r2.dev).
//
// Env vars requeridas (validar en lib/env.ts):
//   CF_R2_ACCOUNT_ID, CF_R2_ACCESS_KEY, CF_R2_SECRET,
//   CF_R2_BUCKET, CF_R2_PUBLIC_BASE_URL

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`[r2] missing env ${name}`);
  }
  return v;
}

function r2Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

let cachedClient: S3Client | null = null;

function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    region: "auto",
    endpoint: r2Endpoint(getEnv("CF_R2_ACCOUNT_ID")),
    credentials: {
      accessKeyId: getEnv("CF_R2_ACCESS_KEY"),
      secretAccessKey: getEnv("CF_R2_SECRET"),
    },
  });
  return cachedClient;
}

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const MAX_BYTES = 5 * 1024 * 1024;

export type PresignedUpload = {
  url: string;
  cdnUrl: string;
  r2Key: string;
  expiresIn: number;
};

export async function presignProductImageUpload(opts: {
  productId: number;
  filename: string;
  contentType: string;
}): Promise<PresignedUpload> {
  if (!ALLOWED_MIME.has(opts.contentType)) {
    throw new Error(`Tipo de imagen no permitido: ${opts.contentType}`);
  }

  const safeName = opts.filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const stamp = Date.now();
  const rnd = Math.random().toString(36).slice(2, 8);
  const r2Key = `products/${opts.productId}/${stamp}-${rnd}-${safeName}`;

  const cmd = new PutObjectCommand({
    Bucket: getEnv("CF_R2_BUCKET"),
    Key: r2Key,
    ContentType: opts.contentType,
    ContentLength: undefined, // browser sets at upload
    Metadata: { "product-id": String(opts.productId) },
  });

  const url = await getSignedUrl(getClient(), cmd, { expiresIn: 300 });
  const cdnBase = getEnv("CF_R2_PUBLIC_BASE_URL").replace(/\/+$/, "");
  const cdnUrl = `${cdnBase}/${r2Key}`;

  return { url, cdnUrl, r2Key, expiresIn: 300 };
}

export const R2_LIMITS = {
  ALLOWED_MIME: Array.from(ALLOWED_MIME),
  MAX_BYTES,
} as const;
