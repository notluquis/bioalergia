import { db } from "@finanzas/db";
import { logEvent, logWarn } from "../../lib/logger";
import { TYPE_TO_PROSPECT_KIND } from "./zonas";

const PLACES_API_BASE = "https://maps.googleapis.com/maps/api/place";

type PlaceNearbyResult = {
  place_id: string;
  name: string;
  vicinity?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
  types?: string[];
  geometry?: { location?: { lat: number; lng: number } };
};

type PlaceDetailsResult = {
  place_id: string;
  name?: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
  types?: string[];
  url?: string;
  address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
};

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY no configurada");
  return key;
}

function extractDomain(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function extractComuna(addressComponents?: PlaceDetailsResult["address_components"]): string {
  if (!addressComponents) return "";
  const comuna = addressComponents.find((c) => c.types.includes("administrative_area_level_3"));
  if (comuna) return comuna.long_name.toUpperCase();
  const locality = addressComponents.find((c) => c.types.includes("locality"));
  return locality?.long_name.toUpperCase() ?? "";
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type DiscoverParams = {
  lat: number;
  lng: number;
  radius: number;
  type?: string;
  textQuery?: string;
  ciudad: string;
  region?: string;
  maxResults?: number;
};

export type DiscoverResult = {
  found: number;
  inserted: number;
  updated: number;
  errors: number;
  prospectIds: string[];
};

async function nearbySearch(
  apiKey: string,
  params: DiscoverParams,
  pageToken?: string,
): Promise<{ results: PlaceNearbyResult[]; nextPageToken?: string }> {
  const url = new URL(`${PLACES_API_BASE}/nearbysearch/json`);
  if (pageToken) {
    url.searchParams.set("pagetoken", pageToken);
  } else {
    url.searchParams.set("location", `${params.lat},${params.lng}`);
    url.searchParams.set("radius", String(params.radius));
    if (params.type) url.searchParams.set("type", params.type);
    if (params.textQuery) url.searchParams.set("keyword", params.textQuery);
  }
  url.searchParams.set("key", apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Google Places nearbysearch ${res.status}`);
  const json = (await res.json()) as {
    status: string;
    error_message?: string;
    results?: PlaceNearbyResult[];
    next_page_token?: string;
  };
  if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
    throw new Error(`Google Places error: ${json.status} ${json.error_message ?? ""}`);
  }
  return { results: json.results ?? [], nextPageToken: json.next_page_token };
}

async function placeDetails(apiKey: string, placeId: string): Promise<PlaceDetailsResult | null> {
  const url = new URL(`${PLACES_API_BASE}/details/json`);
  url.searchParams.set("place_id", placeId);
  url.searchParams.set(
    "fields",
    "place_id,name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,business_status,types,url,address_components",
  );
  url.searchParams.set("key", apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const json = (await res.json()) as { status: string; result?: PlaceDetailsResult };
  if (json.status !== "OK") return null;
  return json.result ?? null;
}

export async function discoverGooglePlaces(params: DiscoverParams): Promise<DiscoverResult> {
  const apiKey = getApiKey();
  const out: DiscoverResult = { found: 0, inserted: 0, updated: 0, errors: 0, prospectIds: [] };

  let pageToken: string | undefined;
  let pages = 0;
  const maxPages = 3;
  const seenIds = new Set<string>();

  do {
    if (pageToken) await sleep(2000);
    let page;
    try {
      page = await nearbySearch(apiKey, params, pageToken);
    } catch (err) {
      logWarn("[outreach.google-places] nearbysearch failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      out.errors += 1;
      break;
    }
    for (const r of page.results) {
      if (seenIds.has(r.place_id)) continue;
      seenIds.add(r.place_id);
      out.found += 1;
      try {
        const details = await placeDetails(apiKey, r.place_id);
        await sleep(120);
        const merged: PlaceDetailsResult = { ...details, ...r, place_id: r.place_id };
        const externalId = `gp:${r.place_id}`;
        const dominio = extractDomain(merged.website);
        const tipoFromType = (merged.types ?? []).find((t) => TYPE_TO_PROSPECT_KIND[t]);
        const tipo = tipoFromType ? TYPE_TO_PROSPECT_KIND[tipoFromType] : "EMPRESA";
        const comuna = extractComuna(merged.address_components) || params.ciudad.toUpperCase();

        const existing = await db.outreachEstablishment.findUnique({
          where: { rbd: externalId },
        });
        const data = {
          nombre: merged.name ?? r.name,
          tipo,
          fuente: "GOOGLE_PLACES" as const,
          comuna,
          ciudad: params.ciudad,
          region: params.region ?? "Bío Bío",
          direccion: merged.formatted_address ?? r.vicinity ?? null,
          telefonoMineduc:
            merged.formatted_phone_number ?? merged.international_phone_number ?? null,
          googlePlaceId: r.place_id,
          categoria: (merged.types ?? []).join(","),
          dominio,
          rating: merged.rating ?? null,
          totalReviews: merged.user_ratings_total ?? null,
          estadoNegocio: merged.business_status ?? null,
          websiteUrl: merged.website ?? null,
          activo: merged.business_status !== "CLOSED_PERMANENTLY",
        };
        if (existing) {
          await db.outreachEstablishment.update({ where: { rbd: externalId }, data });
          out.updated += 1;
        } else {
          await db.outreachEstablishment.create({
            data: { rbd: externalId, ...data },
          });
          out.inserted += 1;
        }
        out.prospectIds.push(externalId);
      } catch (err) {
        logWarn("[outreach.google-places] place upsert failed", {
          placeId: r.place_id,
          error: err instanceof Error ? err.message : String(err),
        });
        out.errors += 1;
      }
      if (params.maxResults && out.prospectIds.length >= params.maxResults) {
        pageToken = undefined;
        break;
      }
    }
    pageToken = page.nextPageToken;
    pages += 1;
  } while (pageToken && pages < maxPages);

  logEvent("[outreach.google-places] discover done", { ...out, params });
  return out;
}
