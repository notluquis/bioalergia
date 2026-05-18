// Build-time sitemap generator. Reads canonical product slugs from
// apps/api/src/scripts/seed-products.data.json (same source of truth
// as the DB seed) and writes apps/site/public/sitemap.xml.
//
// Golden 2026 pattern for static-hosted SPA: sitemap is regenerated on
// each build; if admin adds a product via the intranet UI without a
// site rebuild, Google still discovers it by crawling /tienda links.
//
// Run via: pnpm -F @finanzas/site sitemap (also chained into `build`).

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.VITE_STOREFRONT_URL ?? "https://bioalergia.cl").replace(/\/$/, "");
const SEED_PATH = resolve(HERE, "../../api/src/scripts/seed-products.data.json");
const OUT_PATH = resolve(HERE, "../public/sitemap.xml");

const today = new Date().toISOString().slice(0, 10);

function buildUrl(path, priority, changefreq) {
  return `  <url>
    <loc>${BASE}${path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

async function main() {
  let seed;
  try {
    seed = JSON.parse(await readFile(SEED_PATH, "utf8"));
  } catch (err) {
    console.warn("[sitemap] no seed file; emitting minimal sitemap", err.message);
    seed = { products: [], categories: [] };
  }

  const entries = [
    buildUrl("/", "1.0", "weekly"),
    buildUrl("/tienda", "0.9", "daily"),
    ...seed.categories.map((c) => buildUrl(`/tienda?categoria=${c.slug}`, "0.7", "weekly")),
    ...seed.products.map((p) => {
      const slug =
        p.slug ??
        p.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
      return buildUrl(`/producto/${slug}`, "0.8", "weekly");
    }),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;

  await writeFile(OUT_PATH, xml, "utf8");
  console.log(`[sitemap] wrote ${entries.length} urls → ${OUT_PATH}`);
}

main().catch((err) => {
  console.error("[sitemap] failed:", err);
  process.exit(1);
});
