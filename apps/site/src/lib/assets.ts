/**
 * Cloudflare R2 public CDN base for the marketing site's graphic content.
 * All site imagery (clinic photos, brand marks) lives under `site/` in the
 * `bioalergia-store` bucket and is served from the custom domain
 * `cdn.bioalergia.cl` (same CDN the shop already uses for product images).
 */
export const CDN_BASE = "https://cdn.bioalergia.cl/site";

export const brandAsset = (file: string) => `${CDN_BASE}/brand/${file}`;
export const photoAsset = (file: string) => `${CDN_BASE}/fotos/${file}`;
