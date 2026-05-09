import type {
  CxCommercialOffice,
  CxCommune,
  CxRateInput,
  CxRateResponse,
  CxRegion,
  CxTransportOrderInput,
  CxTransportOrderResponse,
} from "./types";

export interface ChilexpressConfig {
  coverageApiKey: string;
  ratingApiKey: string;
  ordersApiKey: string;
  clientRut: string;
  originCoverageCode: string;
  sandbox: boolean;
}

type CxApi = "georeference" | "rating" | "transport-orders";

function getBaseUrl(sandbox: boolean) {
  const host = sandbox ? "testservices.wschilexpress.com" : "services.wschilexpress.com";
  return `https://${host}`;
}

function getApiKey(config: ChilexpressConfig, api: CxApi): string {
  if (api === "georeference") return config.coverageApiKey;
  if (api === "rating") return config.ratingApiKey;
  return config.ordersApiKey;
}

async function cxFetch<T>(
  config: ChilexpressConfig,
  api: CxApi,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const base = `${getBaseUrl(config.sandbox)}/${api}/api/v1.0`;
  const url = `${base}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": getApiKey(config, api),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`ChileExpress API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Coverage ─────────────────────────────────────────────────────────────────
//
// Chilexpress' georeference responses are flat at the top level (verified
// against testservices.wschilexpress.com): { regions, statusCode, ... },
// { coverageAreas, statusCode, ... }, { commercialOffices, statusCode, ... }.
// They do NOT wrap payload under a `data` key. The earlier client read
// `data.data.regions` etc., which always returned undefined and made the
// frontend Selects appear empty.

export async function getRegions(config: ChilexpressConfig): Promise<CxRegion[]> {
  const data = await cxFetch<{ regions?: CxRegion[] }>(config, "georeference", "/regions");
  return data.regions ?? [];
}

export async function getCommunes(
  config: ChilexpressConfig,
  regionCode: string,
): Promise<CxCommune[]> {
  // type=1 returns one entry per comuna (no sub-zone duplicates).
  // (type=0 = all coverage zones; type=2 = sectores dentro de comuna.)
  const data = await cxFetch<{
    coverageAreas?: Array<{
      countyCode: string;
      countyName: string;
      regionCode: string;
      coverageName?: string;
      ineCountyCode?: number;
    }>;
  }>(
    config,
    "georeference",
    `/coverage-areas?RegionCode=${encodeURIComponent(regionCode)}&type=1`,
  );
  return (data.coverageAreas ?? []).map((c) => ({
    countyCode: c.countyCode,
    countyName: c.countyName,
    regionCode: c.regionCode,
    coverageName: c.coverageName,
    ineCountyCode: c.ineCountyCode,
    // Aliases consumed elsewhere in the app.
    regionId: c.regionCode,
    coverageRegionCode: c.countyCode,
  }));
}

/**
 * Chilexpress' canonical office endpoint is
 * `GET /georeference/api/v1.0/offices?Type=0&RegionCode=...&CountyName=...`
 * Type=0 lists "Sucursales propias" (drop-off / pickup at Chilexpress
 * branches). The earlier client used a non-existent `/commercial-offices`
 * path that returned 404 for every query.
 */
export async function getCommercialOffices(
  config: ChilexpressConfig,
  options: { regionCode: string; countyName: string },
): Promise<CxCommercialOffice[]> {
  type CxRawOffice = {
    addressId: number;
    countyName: string;
    regionName: string;
    officeName: string;
    officeType: number;
    streetName: string;
    streetNumber: number;
    complement?: string;
    latitude?: string;
    longitude?: string;
    telephone?: string;
    businessHour?: Array<{
      day: string;
      initialStartHour: string;
      initialEndHour: string;
      finalStartHour: string;
      finalEndHour: string;
    }>;
  };
  const data = await cxFetch<{ offices?: CxRawOffice[] }>(
    config,
    "georeference",
    `/offices?Type=0&RegionCode=${encodeURIComponent(options.regionCode)}&CountyName=${encodeURIComponent(options.countyName)}`,
  );
  return (data.offices ?? []).map((o) => ({
    commercialOfficeId: String(o.addressId),
    commercialOfficeName: o.officeName,
    street: o.streetName,
    number: String(o.streetNumber),
    commune: o.countyName,
    region: o.regionName,
    schedules: (o.businessHour ?? [])
      .map(
        (b) =>
          `${b.day}: ${b.initialStartHour}-${b.initialEndHour}${
            b.finalStartHour ? ` / ${b.finalStartHour}-${b.finalEndHour}` : ""
          }`,
      )
      .join(" · "),
    latitude: o.latitude ? Number(o.latitude) : undefined,
    longitude: o.longitude ? Number(o.longitude) : undefined,
  }));
}

// ─── Rating ───────────────────────────────────────────────────────────────────

export async function quoteCourier(
  config: ChilexpressConfig,
  input: CxRateInput,
): Promise<CxRateResponse> {
  return cxFetch<CxRateResponse>(config, "rating", "/rates/courier", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ─── Transport Orders ─────────────────────────────────────────────────────────

export async function createTransportOrder(
  config: ChilexpressConfig,
  input: CxTransportOrderInput,
): Promise<CxTransportOrderResponse> {
  return cxFetch<CxTransportOrderResponse>(config, "transport-orders", "/transport-orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
