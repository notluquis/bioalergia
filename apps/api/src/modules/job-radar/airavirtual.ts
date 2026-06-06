// Adapter airavirtual (ATS chileno) — feed JSON público por empresa:
//   GET https://gcs-files.airavirtual.com/public/feeds/aira_{company}.json  (302→GCS)
//   → { updated_at, offers: [{ id, name, city, region, country, area, subarea,
//        hire_mode, contract_type, remote_work, link, publication_days }], ... }
// Potencia portales de grandes empleadores CL: walmart, cencosud, cencosud_scotiabank,
// ripley, entel, copec, sodexo, komatsu, finning, etc. Todo Chile.
// `company` = slug del feed. La descripción no viene en el listado (null).

import { logWarn } from "../../lib/logger.ts";
import type { RawJob } from "./types.ts";

const FETCH_TIMEOUT_MS = 15_000;
const UA = "BioalergiaJobRadar/1.0 (+personal job search)";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown): string | null {
  if (typeof v === "string") return v.trim().length > 0 ? v.trim() : null;
  if (typeof v === "number") return String(v);
  return null;
}

function titleCase(s: string): string {
  return s
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

// "chile##metropolitana##quilicura" → "Quilicura, Metropolitana"
function cleanLocation(city: string | null, region: string | null): string | null {
  const seg = (s: string | null) =>
    (s ?? "")
      .split("##")
      .map((p) => p.trim())
      .filter((p) => p.length > 0 && p.toLowerCase() !== "chile");
  const citySegs = seg(city);
  const comuna = citySegs.at(-1);
  const reg = seg(region).at(-1);
  const parts = [comuna, reg].filter((p): p is string => Boolean(p)).map((p) => titleCase(p));
  return parts.length > 0 ? [...new Set(parts)].join(", ") : null;
}

// "area##subarea" / snake_case → legible
function cleanArea(area: string | null, subarea: string | null): string | null {
  const pick = subarea ?? area;
  if (!pick) return null;
  const last = pick
    .split("##")
    .map((p) => p.trim())
    .filter(Boolean)
    .at(-1);
  return last ? titleCase(last) : null;
}

function mapRemote(v: string | null): string | null {
  if (!v) return null;
  const up = v.toUpperCase();
  if (up.includes("NO")) return null;
  if (up.includes("HYBRID") || up.includes("HIBRID")) return "Híbrido";
  return "Remoto";
}

function publishedFrom(days: unknown): Date | null {
  if (typeof days !== "number" || !Number.isFinite(days)) return null;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function fetchAiravirtualJobs(company: string): Promise<RawJob[]> {
  let text: string;
  try {
    const res = await fetch(
      `https://gcs-files.airavirtual.com/public/feeds/aira_${encodeURIComponent(company)}.json`,
      {
        headers: { "user-agent": UA, accept: "application/json" },
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    );
    if (!res.ok) {
      logWarn("job_radar.airavirtual.non_ok", { company, status: res.status });
      return [];
    }
    text = await res.text();
  } catch (err) {
    logWarn("job_radar.airavirtual.error", {
      company,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const offers = asRecord(parsed)?.offers;
  if (!Array.isArray(offers)) return [];

  const out: RawJob[] = [];
  for (const item of offers) {
    const o = asRecord(item);
    if (!o) continue;
    const externalId = asString(o.id);
    const title = asString(o.name);
    if (!externalId || !title) continue;
    out.push({
      source: "airavirtual",
      company,
      externalId,
      title,
      url: asString(o.link) ?? `https://login.airavirtual.com/postula/${externalId}`,
      department: cleanArea(asString(o.area), asString(o.subarea)),
      location: cleanLocation(asString(o.city), asString(o.region)),
      remote: mapRemote(asString(o.remote_work)),
      descriptionHtml: null,
      publishedAt: publishedFrom(o.publication_days),
      lastmod: null,
      raw: item,
    });
  }
  return out;
}
