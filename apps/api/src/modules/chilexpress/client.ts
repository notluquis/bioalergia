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

export async function getRegions(config: ChilexpressConfig): Promise<CxRegion[]> {
  const data = await cxFetch<{ data?: { regions?: CxRegion[] } }>(
    config,
    "georeference",
    "/regions",
  );
  return data.data?.regions ?? [];
}

export async function getCommunes(
  config: ChilexpressConfig,
  regionCode: string,
): Promise<CxCommune[]> {
  const data = await cxFetch<{ data?: { counties?: CxCommune[] } }>(
    config,
    "georeference",
    `/communes?regionCode=${encodeURIComponent(regionCode)}`,
  );
  return data.data?.counties ?? [];
}

export async function getCommercialOffices(
  config: ChilexpressConfig,
  coverageRegionCode: string,
): Promise<CxCommercialOffice[]> {
  const data = await cxFetch<{ data?: { commercialOffices?: CxCommercialOffice[] } }>(
    config,
    "georeference",
    `/commercial-offices?coverageRegionCode=${encodeURIComponent(coverageRegionCode)}`,
  );
  return data.data?.commercialOffices ?? [];
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
