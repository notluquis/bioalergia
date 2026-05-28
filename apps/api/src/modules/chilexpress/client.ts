import type {
  CxCommercialOffice,
  CxCommune,
  CxOfficeBusinessHour,
  CxOfficeService,
  CxRateInput,
  CxRateResponse,
  CxRegion,
  CxTransportOrderInput,
  CxTransportOrderResponse,
} from "./types.ts";

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
  options: RequestInit = {}
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
    const friendly = friendlyChilexpressError(res.status, text);
    throw new Error(friendly ?? `ChileExpress API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Mapea mensajes conocidos de Chilexpress (statusDescription + HTTP status) a
 * texto accionable en español para el operador. Cubre los casos del FAQ
 * oficial y los códigos que aparecen en respuestas de error reales.
 *
 * Devuelve null si no hay match → el caller usa el mensaje original.
 */
export function friendlyChilexpressError(httpStatus: number, body: string): null | string {
  // Intentar parsear como JSON; varias APIs (orders, rating) devuelven
  // { statusCode, message, statusDescription } incluso en HTTP 4xx/5xx.
  let parsed: { message?: string; statusDescription?: string; statusCode?: number } | null = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = null;
  }
  const msg = parsed?.statusDescription ?? parsed?.message ?? body;
  const haystack = msg.toLowerCase();

  if (httpStatus === 401 || /invalid subscription key|access denied/i.test(msg)) {
    return "Chilexpress: las credenciales (subscription key) no son válidas o están deshabilitadas. Revisar las API keys del producto correspondiente en el portal dev.";
  }
  if (/no existe tarjeta chilexpress|no existe tarjeta cliente/i.test(haystack)) {
    return "Chilexpress: la TCC configurada no existe en este ambiente. Si estás en sandbox usar la TCC de pruebas (18578680); si estás en producción contactar al ejecutivo.";
  }
  if (/tarjeta no se encuentra vigente|tcc.*suspend|tcc.*vencid/i.test(haystack)) {
    return "Chilexpress: la TCC está suspendida (no pago o cupo excedido). Habilitación tras contactar al ejecutivo demora ~24 h.";
  }
  if (/tcc.*no se encuentra habilitada.*servicio/i.test(haystack)) {
    return "Chilexpress: la TCC no tiene habilitado este servicio (Prioritario / Devolución). Pedirlo al ejecutivo.";
  }
  if (/no existe servicio de entrega.*comunas/i.test(haystack)) {
    return "Chilexpress: no hay servicio de entrega disponible para la combinación origen-destino seleccionada.";
  }
  if (/el largo de la numeraci[oó]n excede/i.test(haystack)) {
    return "Chilexpress: la numeración de la dirección excede el largo permitido.";
  }
  if (/json de entrada no es v[aá]lido/i.test(haystack)) {
    return "Chilexpress: payload JSON inválido (campo malformado o vacío). Reportar como bug si persiste.";
  }
  if (/la orden de transporte consultada no se corresponde al.*rut/i.test(haystack)) {
    return "Chilexpress: la OT consultada no corresponde al RUT del cliente (sandbox usa el RUT 96756430).";
  }
  return null;
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
  type: 1 | 2 = 1
): Promise<CxCommune[]> {
  // type=1 = one entry per comuna (no sub-zone duplicates, default).
  // type=2 = sub-sectores within comunas (e.g. "BUIN - LINDEROS").
  const data = await cxFetch<{
    coverageAreas?: Array<{
      countyCode: string;
      countyName: string;
      regionCode: string;
      coverageName?: string;
      ineCountyCode?: number;
      ind_ppd?: number;
      ind_rd?: number;
    }>;
  }>(
    config,
    "georeference",
    `/coverage-areas?RegionCode=${encodeURIComponent(regionCode)}&type=${type}`
  );
  return (data.coverageAreas ?? []).map((c) => ({
    countyCode: c.countyCode,
    countyName: c.countyName,
    regionCode: c.regionCode,
    coverageName: c.coverageName,
    ineCountyCode: c.ineCountyCode,
    supportsCashOnDelivery: c.ind_ppd === 1,
    supportsReturn: c.ind_rd === 1,
    regionId: c.regionCode,
    coverageRegionCode: c.countyCode,
  }));
}

/**
 * Chilexpress' canonical office endpoint:
 *   GET /georeference/api/v1.0/offices?Type=0&RegionCode=...&CountyName=...
 *
 * Type=0 lists "Sucursales propias", Type=4 lists "Tiendas Pick Up"
 * (partner stores with extended hours). The earlier client used a
 * non-existent `/commercial-offices` path that returned 404 for every
 * query.
 *
 * Returns the FULL office payload so the frontend can render schedules,
 * services, telephone, manager, distance, etc.
 */
type CxRawOffice = {
  addressId: number;
  countyName: string;
  regionName: string;
  regionCode?: string;
  countyCoverageCode?: string | null;
  officeName: string;
  officeType: number;
  officeCode?: number;
  ineCountyId?: number;
  streetName: string;
  streetNumber: number;
  complement?: string;
  latitude?: string;
  longitude?: string;
  telephone?: string;
  managerName?: string;
  eMail?: string;
  distance?: number;
  businessHour?: CxOfficeBusinessHour[];
  officeServices?: CxOfficeService[];
};

function mapOffice(o: CxRawOffice): CxCommercialOffice {
  return {
    commercialOfficeId: String(o.addressId),
    commercialOfficeName: o.officeName,
    officeType: o.officeType,
    street: o.streetName,
    number: String(o.streetNumber),
    complement: o.complement,
    commune: o.countyName,
    region: o.regionName,
    regionCode: o.regionCode ?? "",
    countyCode: o.countyCoverageCode ?? undefined,
    manager: o.managerName,
    phone: o.telephone,
    email: o.eMail || undefined,
    latitude: o.latitude ? Number(o.latitude) : undefined,
    longitude: o.longitude ? Number(o.longitude) : undefined,
    distance: o.distance,
    officeCode: o.officeCode,
    ineCountyId: o.ineCountyId,
    businessHour: (o.businessHour ?? []).filter((b): b is CxOfficeBusinessHour => b != null),
    services: (o.officeServices ?? []).filter((s): s is CxOfficeService => s != null),
    schedules: (o.businessHour ?? [])
      .filter((b) => b.initialStartHour)
      .map(
        (b) =>
          `${b.day}: ${b.initialStartHour}-${b.initialEndHour}${
            b.finalStartHour ? ` / ${b.finalStartHour}-${b.finalEndHour}` : ""
          }`
      )
      .join(" · "),
  };
}

export async function getCommercialOffices(
  config: ChilexpressConfig,
  options: { regionCode: string; countyName: string; type?: 0 | 4 }
): Promise<CxCommercialOffice[]> {
  const type = options.type ?? 0;
  const data = await cxFetch<{ offices?: CxRawOffice[] }>(
    config,
    "georeference",
    `/offices?Type=${type}&RegionCode=${encodeURIComponent(options.regionCode)}&CountyName=${encodeURIComponent(options.countyName)}`
  );
  return (data.offices ?? []).map(mapOffice);
}

// ─── Nearby offices ───────────────────────────────────────────────────────────

export async function getNearbyOffices(
  config: ChilexpressConfig,
  addressId: number,
  options?: {
    /** Spec: 0 = sucursales propias (default) | 4 = Tiendas Pick Up. */
    type?: 0 | 4;
    /** Radio de búsqueda en km (entero, opcional). */
    radius?: number;
  }
): Promise<Array<{ distance: string; office: CxCommercialOffice }>> {
  // Per spec the response key is "nearbyOffice" (singular). Also
  // tolerate "nearbyOffices" in case the API ever harmonises.
  const params = new URLSearchParams();
  if (options?.type != null) params.set("type", String(options.type));
  if (options?.radius != null) params.set("radius", String(Math.trunc(options.radius)));
  const qs = params.toString();
  const data = await cxFetch<{
    nearbyOffice?: Array<{ distance: string; office: CxRawOffice }>;
    nearbyOffices?: Array<{ distance: string; office: CxRawOffice }>;
  }>(config, "georeference", `/nearby-offices/${addressId}${qs ? `?${qs}` : ""}`);
  const list = data.nearbyOffice ?? data.nearbyOffices ?? [];
  return list.map((entry) => ({
    distance: entry.distance,
    office: mapOffice(entry.office),
  }));
}

// ─── Streets autocomplete ────────────────────────────────────────────────────

/**
 * Per the official spec /streets/search is POST with a JSON body. Response
 * uses `streetId` (not `streetNameId`). The `pointsOfInterestEnabled`
 * flag includes plazas/landmarks; `streetNameEnabled` toggles street
 * names. We default both true so the user gets the widest match set.
 */
export async function searchStreets(
  config: ChilexpressConfig,
  options: {
    countyName: string;
    query: string;
    pointsOfInterestEnabled?: boolean;
    streetNameEnabled?: boolean;
    roadType?: number;
    limit?: number;
  }
): Promise<
  Array<{ streetId: number; streetName: string; countyName?: string; roadType?: string }>
> {
  const limit = options.limit ?? 25;
  const data = await cxFetch<{
    streets?: Array<{
      streetId: number;
      streetName: string;
      countyName?: string;
      roadType?: string;
    }>;
  }>(config, "georeference", `/streets/search?limit=${limit}`, {
    method: "POST",
    body: JSON.stringify({
      countyName: options.countyName,
      streetName: options.query,
      pointsOfInterestEnabled: options.pointsOfInterestEnabled ?? true,
      streetNameEnabled: options.streetNameEnabled ?? true,
      roadType: options.roadType ?? 0,
    }),
  });
  return data.streets ?? [];
}

/**
 * Spec response field is `number` (not `streetNumber`); each entry
 * includes lat/lng for the exact street number.
 */
export async function getStreetNumbers(
  config: ChilexpressConfig,
  streetNameId: number,
  /**
   * Filtro opcional del spec: cuando se pasa, el endpoint solo devuelve la
   * entrada exacta para ese número (útil para validar un número específico
   * sin descargar la lista completa de numeraciones de la calle).
   */
  streetNumber?: string | number
): Promise<Array<{ number: number; latitude?: number; longitude?: number; addressId: number }>> {
  const qs =
    streetNumber != null && String(streetNumber).trim() !== ""
      ? `?streetNumber=${encodeURIComponent(String(streetNumber))}`
      : "";
  const data = await cxFetch<{
    streetNumbers?: Array<{
      number: number;
      latitude?: number;
      longitude?: number;
      addressId: number;
    }>;
  }>(config, "georeference", `/streets/${streetNameId}/numbers${qs}`);
  return data.streetNumbers ?? [];
}

// ─── Geocoding ────────────────────────────────────────────────────────────────

export async function georeferenceAddress(
  config: ChilexpressConfig,
  input: { streetName: string; countyName: string; number: string }
): Promise<{ latitude?: string; longitude?: string; addressId?: number } | null> {
  const data = await cxFetch<{
    data?: { latitude?: string; longitude?: string; addressId?: number };
    statusCode?: number;
  }>(config, "georeference", "/addresses/georeference", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (data.statusCode !== 0 || !data.data) return null;
  return data.data;
}

// ─── Rating ───────────────────────────────────────────────────────────────────

export async function quoteCourier(
  config: ChilexpressConfig,
  input: CxRateInput
): Promise<CxRateResponse> {
  return cxFetch<CxRateResponse>(config, "rating", "/rates/courier", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ─── Transport Orders ─────────────────────────────────────────────────────────

export async function createTransportOrder(
  config: ChilexpressConfig,
  input: CxTransportOrderInput
): Promise<CxTransportOrderResponse> {
  return cxFetch<CxTransportOrderResponse>(config, "transport-orders", "/transport-orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function reprintLabel(
  config: ChilexpressConfig,
  input: { transportOrderNumber: string; labelType?: number; reportType?: number }
): Promise<{ label?: string; barcode?: string; reference?: string }> {
  const body = {
    transportOrderNumber: input.transportOrderNumber,
    labelType: input.labelType ?? 2,
    reportType: input.reportType ?? 0,
  };
  const res = await cxFetch<{
    data?: {
      detail?: {
        transportOrderNumber: string;
        reference?: string;
        barcode?: string;
      };
      label?: string;
    };
    statusCode?: number;
    statusDescription?: string;
  }>(config, "transport-orders", "/transport-orders-labels", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (res.statusCode !== 0 || !res.data) {
    throw new Error(`Chilexpress reprint failed: ${res.statusDescription ?? "unknown"}`);
  }
  return {
    label: res.data.label,
    barcode: res.data.detail?.barcode,
    reference: res.data.detail?.reference,
  };
}

export async function trackTransportOrder(
  config: ChilexpressConfig,
  transportOrderNumber: string
): Promise<{
  statusCodeReference?: string;
  statusDescription?: string;
  events: Array<{ date?: string; name?: string; location?: string }>;
}> {
  const res = await cxFetch<{
    data?: {
      transportOrderNumber?: string;
      statusCodeReference?: string;
      statusDescription?: string;
      events?: Array<{ eventDate?: string; eventName?: string; eventLocation?: string }>;
    };
    statusCode?: number;
    statusDescription?: string;
  }>(config, "transport-orders", "/tracking", {
    method: "POST",
    body: JSON.stringify({ transportOrderNumber }),
  });
  return {
    statusCodeReference: res.data?.statusCodeReference,
    statusDescription: res.data?.statusDescription,
    events: (res.data?.events ?? []).map((e) => ({
      date: e.eventDate,
      name: e.eventName,
      location: e.eventLocation,
    })),
  };
}
