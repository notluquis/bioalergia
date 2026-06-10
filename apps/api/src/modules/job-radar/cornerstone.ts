// Adapter Cornerstone OnDemand (CSOD) — career sites "ux" (SPA React). El listado
// vive en una API JSON pública en el host cloud `us.api.csod.com`. Flujo:
//   1. GET https://{tenant}.csod.com/ux/ats/careersite/{cid}/home?c={tenant}
//      → el HTML trae `csod.context.token` (JWT anónimo, ~3h, scope careersite).
//   2. POST https://us.api.csod.com/rec-job-search/external/jobs  (Bearer token)
//      body { careerSiteId, pageNumber, pageSize, cultureId, radius:null,
//             postingsWithinDays:null, ... } → { data: { totalCount, requisitions[] } }
//
// GOTCHA: `radius` y `postingsWithinDays` DEBEN ir `null` — con `0` el server
// filtra a "0 km / 0 días" y devuelve totalCount:0 (parece geo-fence, no lo es).
// `identifier` = "{tenant}:{cid}" (cid = careersite, ej Cencosud Chile = 5,
// Banco Security = 1). corp = tenant.

import {
  BROWSER_UA,
  asRecord,
  asString,
  deriveLocationFromText,
  deriveRemoteFromText,
  requestText,
  safeJsonParse,
} from "./_shared.ts";
import type { RawJob } from "./types.ts";

const PAGE_SIZE = 50;
const MAX_PAGES = 40;

interface CsodEntry {
  tenant: string;
  cid: number;
}

export function parseCornerstoneEntry(identifier: string): CsodEntry | null {
  const [tenant, cidRaw] = identifier.split(":");
  const cid = Number(cidRaw);
  if (!tenant || !Number.isInteger(cid)) return null;
  return { tenant, cid };
}

// cuid (cultureId) del payload del JWT; default 14 si no se puede leer.
function cultureFromToken(token: string): number {
  try {
    const part = token.split(".")[1];
    const json = JSON.parse(
      Buffer.from(part + "=".repeat((4 - (part.length % 4)) % 4), "base64").toString("utf8")
    ) as { cuid?: number };
    return typeof json.cuid === "number" ? json.cuid : 14;
  } catch {
    return 14;
  }
}

function parseMdy(raw: unknown): Date | null {
  if (typeof raw !== "string") return null;
  const m = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]), 12)) : null;
}

function locationOf(req: Record<string, unknown>): { location: string | null; country: string | null } {
  const locs = Array.isArray(req.locations) ? req.locations : [];
  const first = asRecord(locs[0]);
  if (!first) return { location: null, country: null };
  const parts = [asString(first.city), asString(first.state), asString(first.country)].filter(
    (p): p is string => Boolean(p)
  );
  return {
    location: parts.length > 0 ? [...new Set(parts)].join(", ") : null,
    country: asString(first.country),
  };
}

function stripHtml(html: string | null): string | null {
  if (!html) return null;
  const t = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return t.length > 0 ? t : null;
}

/**
 * Trae las ofertas vigentes (Chile) de un career site Cornerstone.
 * `identifier` = "{tenant}:{cid}". Devuelve [] si no resuelve el token.
 */
export async function fetchCornerstoneJobs(identifier: string): Promise<RawJob[]> {
  const entry = parseCornerstoneEntry(identifier);
  if (!entry) return [];
  const { tenant, cid } = entry;

  const html = await requestText(
    `https://${tenant}.csod.com/ux/ats/careersite/${cid}/home?c=${tenant}`,
    { tag: "job_radar.cornerstone.page", ctx: { tenant, cid }, accept: "text/html,*/*", userAgent: BROWSER_UA }
  );
  if (!html) return [];
  const token = html.match(/"token"\s*:\s*"([^"]+)"/)?.[1];
  if (!token) return [];
  const cultureId = cultureFromToken(token);
  // El host del API cloud es per-tenant ({region}.api.csod.com); lo leemos de la
  // página (endpoints.cloud), fallback us.
  const cloud = html.match(/"cloud"\s*:\s*"(https:\/\/[^"]+?)\/?"/)?.[1] ?? "https://us.api.csod.com";
  const searchUrl = `${cloud}/rec-job-search/external/jobs`;

  const out: RawJob[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const body = JSON.stringify({
      careerSiteId: cid,
      careerSitePageId: cid,
      pageNumber: page,
      pageSize: PAGE_SIZE,
      cultureId,
      searchText: "",
      cultureName: "es-MX",
      states: [],
      countryCodes: [],
      cities: [],
      placeID: "",
      radius: null, // NO 0: con 0 filtra a 0km y devuelve vacío
      postingsWithinDays: null, // idem
      customFieldCheckboxKeys: [],
      customFieldDropdowns: [],
      customFieldRadios: [],
    });
    const text = await requestText(searchUrl, {
      method: "POST",
      body,
      tag: "job_radar.cornerstone",
      ctx: { tenant, cid, page },
      headers: { authorization: `Bearer ${token}`, "csod-accept-language": "es-MX" },
    });
    if (!text) break;
    const data = asRecord(asRecord(safeJsonParse(text))?.data);
    const reqs = data?.requisitions;
    if (!Array.isArray(reqs) || reqs.length === 0) break;

    let added = 0;
    for (const item of reqs) {
      const req = asRecord(item);
      if (!req) continue;
      const externalId = asString(req.requisitionId);
      const title = asString(req.displayJobTitle);
      if (!externalId || !title || seen.has(externalId)) continue;
      const { location, country } = locationOf(req);
      const descriptionHtml = asString(req.externalDescription);
      if (country && country.toUpperCase() !== "CL") continue; // solo Chile
      seen.add(externalId);
      out.push({
        source: "cornerstone",
        company: tenant,
        externalId,
        title,
        url: `https://${tenant}.csod.com/ux/ats/careersite/${cid}/home/requisition/${externalId}?c=${tenant}`,
        department: null,
        location: location ?? deriveLocationFromText(title, descriptionHtml),
        remote: deriveRemoteFromText(title, descriptionHtml),
        salary: null,
        descriptionHtml,
        publishedAt: parseMdy(req.postingEffectiveDate),
        lastmod: parseMdy(req.postingExpirationDate) ?? parseMdy(req.postingEffectiveDate),
        raw: { requisitionId: externalId, title, desc: stripHtml(descriptionHtml)?.slice(0, 200) ?? null },
      });
      added++;
    }
    const total = data?.totalCount;
    if (added === 0 || (typeof total === "number" && seen.size >= total)) break;
  }
  return out;
}
