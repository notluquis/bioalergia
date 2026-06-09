// Adapter Buk (`{slug}.buk.cl`, suite HR/payroll dominante en el mid-market CL).
// El portal "trabaja con nosotros" es HTML server-rendered, sin API JSON. Cada
// card lleva el título (en `<p class="d-none">`, el nombre completo) y el link
// `/s/{token}` (token = externalId). `identifier` = slug del subdominio (ej hites).

import { BROWSER_UA, requestText } from "./_shared.ts";
import type { RawJob } from "./types.ts";

const MAX_PAGES = 20;

function clean(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function parseCards(html: string, slug: string): RawJob[] {
  const out: RawJob[] = [];
  // Card = bloque `jobs__card` … con su link `/s/{token}`.
  for (const m of html.matchAll(/jobs__card[\s\S]*?\/s\/([A-Za-z0-9]{6,})/g)) {
    const token = m[1];
    const block = m[0];
    // Título completo en <p class="d-none">…</p>; fallback al <b> visible.
    const full = block.match(/class="d-none"[^>]*>([\s\S]*?)<\/p>/i);
    const bold = block.match(/<b[^>]*>([\s\S]*?)<\/b>/i);
    const title = clean(full?.[1] ?? bold?.[1] ?? "");
    if (!title) continue;
    out.push({
      source: "buk",
      company: slug,
      externalId: token,
      title,
      url: `https://${slug}.buk.cl/s/${token}`,
      department: bold ? clean(bold[1]) : null,
      location: null, // no expuesta en la lista (queda en el detalle)
      remote: null,
      salary: null,
      descriptionHtml: null,
      publishedAt: null,
      lastmod: null,
      raw: { token, title },
    });
  }
  return out;
}

/**
 * Trae las ofertas vigentes de un portal Buk. `identifier` = slug del subdominio.
 * Devuelve [] si no hay portal/ofertas.
 */
export async function fetchBukJobs(identifier: string): Promise<RawJob[]> {
  const slug = identifier.trim().toLowerCase();
  const out: RawJob[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const html = await requestText(
      `https://${slug}.buk.cl/trabaja-con-nosotros?page=${page}`,
      { tag: "job_radar.buk", ctx: { slug, page }, accept: "text/html,*/*", userAgent: BROWSER_UA }
    );
    if (!html) break;
    const cards = parseCards(html, slug);
    let added = 0;
    for (const j of cards) {
      if (seen.has(j.externalId)) continue;
      seen.add(j.externalId);
      out.push(j);
      added++;
    }
    if (added === 0) break; // sin tokens nuevos → última página
  }
  return out;
}
