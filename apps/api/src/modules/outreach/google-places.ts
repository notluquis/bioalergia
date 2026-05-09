import { db } from "@finanzas/db";
import { logEvent, logWarn } from "../../lib/logger.ts";
import { TYPE_TO_PROSPECT_KIND } from "./zonas.ts";

// Places API (New) — places.googleapis.com/v1
// Docs: https://developers.google.com/maps/documentation/places/web-service/op-overview
const PLACES_API_BASE = "https://places.googleapis.com/v1";

// FieldMask: solo se cobra por los campos pedidos. Estos son los Pro+Atmosphere SKU mínimos.
const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.addressComponents",
  "places.location",
  "places.types",
  "places.primaryType",
  "places.businessStatus",
  "places.rating",
  "places.userRatingCount",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "nextPageToken",
].join(",");

type PlaceNew = {
  id: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
  location?: { latitude: number; longitude: number };
  types?: string[];
  primaryType?: string;
  businessStatus?: string;
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
};

type SearchNearbyResponse = {
  places?: PlaceNew[];
  nextPageToken?: string;
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

function extractComuna(p: PlaceNew, fallback: string): string {
  const comps = p.addressComponents ?? [];
  const comuna =
    comps.find((c) => c.types?.includes("administrative_area_level_3")) ??
    comps.find((c) => c.types?.includes("locality")) ??
    comps.find((c) => c.types?.includes("administrative_area_level_2"));
  return (comuna?.longText ?? fallback).toUpperCase();
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

async function searchNearby(
  apiKey: string,
  params: DiscoverParams,
  pageToken?: string,
): Promise<SearchNearbyResponse> {
  const body: Record<string, unknown> = {
    locationRestriction: {
      circle: {
        center: { latitude: params.lat, longitude: params.lng },
        radius: params.radius,
      },
    },
    maxResultCount: 20,
    languageCode: "es-CL",
    regionCode: "CL",
  };
  if (params.type) body.includedTypes = [params.type];
  if (pageToken) body.pageToken = pageToken;

  const res = await fetch(`${PLACES_API_BASE}/places:searchNearby`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": SEARCH_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Places searchNearby ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as SearchNearbyResponse;
}

async function searchText(
  apiKey: string,
  params: DiscoverParams,
  pageToken?: string,
): Promise<SearchNearbyResponse> {
  if (!params.textQuery) throw new Error("textQuery requerido");
  const body: Record<string, unknown> = {
    textQuery: params.textQuery,
    locationBias: {
      circle: {
        center: { latitude: params.lat, longitude: params.lng },
        radius: params.radius,
      },
    },
    pageSize: 20,
    languageCode: "es-CL",
    regionCode: "CL",
  };
  if (params.type) body.includedType = params.type;
  if (pageToken) body.pageToken = pageToken;

  const res = await fetch(`${PLACES_API_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": SEARCH_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Places searchText ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as SearchNearbyResponse;
}

function normalizePlaceId(id: string): string {
  // Places API (New) returns ids with optional "places/" prefix.
  return id.startsWith("places/") ? id.slice("places/".length) : id;
}

export async function discoverGooglePlaces(params: DiscoverParams): Promise<DiscoverResult> {
  const apiKey = getApiKey();
  const out: DiscoverResult = { found: 0, inserted: 0, updated: 0, errors: 0, prospectIds: [] };

  const useTextSearch = Boolean(params.textQuery);
  let pageToken: string | undefined;
  let pages = 0;
  const maxPages = 5; // New API permite más pero capamos por costo
  const seenIds = new Set<string>();

  do {
    if (pageToken) await sleep(2000);
    let page: SearchNearbyResponse;
    try {
      page = useTextSearch
        ? await searchText(apiKey, params, pageToken)
        : await searchNearby(apiKey, params, pageToken);
    } catch (err) {
      logWarn("[outreach.google-places] search failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      out.errors += 1;
      break;
    }

    for (const p of page.places ?? []) {
      const placeId = normalizePlaceId(p.id);
      if (!placeId || seenIds.has(placeId)) continue;
      seenIds.add(placeId);
      out.found += 1;

      try {
        const externalId = `gp:${placeId}`;
        const dominio = extractDomain(p.websiteUri);
        const tipoFromType =
          (p.types ?? []).find((t) => TYPE_TO_PROSPECT_KIND[t]) ??
          (p.primaryType && TYPE_TO_PROSPECT_KIND[p.primaryType]
            ? p.primaryType
            : undefined);
        const tipo = tipoFromType ? TYPE_TO_PROSPECT_KIND[tipoFromType] : "EMPRESA";
        const comuna = extractComuna(p, params.ciudad);

        const data = {
          nombre: p.displayName?.text ?? "(sin nombre)",
          tipo,
          fuente: "GOOGLE_PLACES" as const,
          comuna,
          ciudad: params.ciudad,
          region: params.region ?? "Bío Bío",
          direccion: p.formattedAddress ?? p.shortFormattedAddress ?? null,
          telefonoMineduc: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
          googlePlaceId: placeId,
          categoria: (p.types ?? []).join(","),
          dominio,
          rating: p.rating ?? null,
          totalReviews: p.userRatingCount ?? null,
          estadoNegocio: p.businessStatus ?? null,
          websiteUrl: p.websiteUri ?? null,
          activo: p.businessStatus !== "CLOSED_PERMANENTLY",
        };

        const existing = await db.outreachEstablishment.findUnique({
          where: { rbd: externalId },
        });
        if (existing) {
          await db.outreachEstablishment.update({ where: { rbd: externalId }, data });
          out.updated += 1;
        } else {
          await db.outreachEstablishment.create({ data: { rbd: externalId, ...data } });
          out.inserted += 1;
        }
        out.prospectIds.push(externalId);
      } catch (err) {
        logWarn("[outreach.google-places] place upsert failed", {
          placeId,
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
