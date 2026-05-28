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
  /** TCC (Tarjeta Cliente Chilexpress) — el cargo de los envíos va acá. */
  clientRut: string;
  /**
   * RUT de la empresa que genera las OTs (sin puntos ni DV). Necesario para
   * los endpoints /tracking y /tracking/bulk como campo obligatorio según el
   * spec. En sandbox = 96756430.
   */
  companyRut?: string;
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

/**
 * Cotización. Si `input.customerCardNumber` (TCC) está presente, se llama al
 * endpoint /rates/business (tarifa empresa) que devuelve `serviceValueDiscount`
 * con el precio final tras el descuento de cliente. Sin TCC, /rates/courier
 * (tarifa estándar).
 *
 * El spec declara `package.weight/height/width/length` como strings con punto
 * decimal. JSON.stringify de un number JS produce el mismo texto, pero
 * serializamos a string explícitamente para alinear con el spec y soportar
 * decimales en dimensiones (FAQ "hasta 2 decimales separados por punto").
 */
export async function quoteCourier(
  config: ChilexpressConfig,
  input: CxRateInput
): Promise<CxRateResponse> {
  const isBusiness =
    typeof input.customerCardNumber === "string" && input.customerCardNumber.trim() !== "";
  const path = isBusiness ? "/rates/business" : "/rates/courier";
  const body = {
    originCountyCode: input.originCountyCode,
    destinationCountyCode: input.destinationCountyCode,
    package: {
      weight: toRateDecimal(input.package.weight),
      height: toRateDecimal(input.package.height),
      width: toRateDecimal(input.package.width),
      length: toRateDecimal(input.package.length),
    },
    productType: input.productType,
    contentType: input.contentType,
    declaredWorth: input.declaredWorth,
    deliveryTime: input.deliveryTime,
    ...(isBusiness ? { customerCardNumber: input.customerCardNumber } : {}),
  };
  return cxFetch<CxRateResponse>(config, "rating", path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Convierte un número JS a la string con punto decimal y ≤2 decimales que
 * exige el spec de cotización. `toFixed(2)` daría `"0.20"`; preferimos
 * `"0.2"`/`"5"` (sin ceros sobrantes) para coincidir con los ejemplos.
 */
function toRateDecimal(value: number | string): string {
  if (typeof value === "string") return value;
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
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

// ─── Tracking ─────────────────────────────────────────────────────────────────

export interface CxTrackingEvent {
  /** Fecha del evento (YYYY-MM-DD). */
  date?: string;
  /** Hora del evento. */
  hour?: string;
  /** ISO 8601 fecha+hora completa. */
  dateTime?: string;
  /** Descripción técnica Chilexpress (ej. "PIEZA ENTREGADA A DESTINATARIO"). */
  description?: string;
  /** Descripción mapeada al lenguaje del cliente (ej. "ENTREGADO"). */
  clientDescription?: string;
  /** Código interno del evento Chilexpress. */
  eventCode?: string;
  /** Código compuesto interno. */
  compEventCode?: string;
  /** Código mapeado al cliente. */
  clientEventCode?: string;
  motive?: string;
  location?: string;
  latitude?: string;
  longitude?: string;
  officeId?: string;
  /** URL al PDF del certificado de entrega (POD), si el evento es entrega. */
  certificadoEntrega?: string;
}

export interface CxTrackingResult {
  statusDescription?: string;
  /** Estado actual del envío (ej. "DESCARGADA", "ENTREGADO"). */
  status?: string;
  /** Locación del estado actual. */
  locationStatus?: string;
  /** Servicio (ej. DHS, CHEX). */
  service?: string;
  /** Producto (ENCOMIENDA, DOCUMENTO). */
  product?: string;
  /** Dimensiones (ej. "20x40x20"). */
  dimensions?: string;
  weight?: string;
  certificateNumber?: string;
  reference?: string;
  delivery?: {
    receptorName?: string;
    receptorRut?: string;
    deliveryDate?: string;
    deliveryHour?: string;
    deliveryDateTime?: string;
  };
  address?: {
    address?: string;
    destinationCoverageCode?: string;
    originCoverageCode?: string;
    latitude?: string;
    longitude?: string;
  };
  events: CxTrackingEvent[];
}

export async function trackTransportOrder(
  config: ChilexpressConfig,
  input: {
    transportOrderNumber: string | number;
    /** Referencia del cliente (deliveryReference). Spec obligatorio. */
    reference?: string;
    /** RUT empresa sin puntos/DV (ej. 96756430). Spec obligatorio. */
    rut?: string | number;
    /** 0 = solo estado actual, 1 = todos los eventos. Default 1. */
    showTrackingEvents?: 0 | 1;
  }
): Promise<CxTrackingResult> {
  const body = {
    transportOrderNumber:
      typeof input.transportOrderNumber === "string"
        ? Number(input.transportOrderNumber)
        : input.transportOrderNumber,
    reference: input.reference ?? "",
    rut: typeof input.rut === "string" ? Number(input.rut) : (input.rut ?? 0),
    showTrackingEvents: input.showTrackingEvents ?? 1,
  };
  const res = await cxFetch<{
    data?: {
      addressData?: {
        destinationCoverageCode?: string;
        originCoverageCode?: string;
        address?: string;
        latitude?: string;
        longitude?: string;
      };
      deliveryData?: {
        receptorRut?: string;
        receptorName?: string;
        deliveryDate?: string;
        deliveryHour?: string;
        deliveryDateTime?: string;
      };
      trackingEvents?: Array<{
        eventDate?: string;
        eventHour?: string;
        description?: string;
        motive?: string;
        location?: string;
        latitude?: string;
        longitude?: string;
        eventDateTime?: string;
        officeId?: string;
        certificadoEntrega?: string;
        code?: {
          eventCode?: string;
          compEventCode?: string;
          clientEventCode?: string;
          clientCompEventCode?: string;
          clientEventDescription?: string;
        };
      }>;
      transportOrderData?: {
        transportOrderNumber?: string;
        certificateNumber?: string;
        reference?: string;
        product?: string;
        service?: string;
        dimensions?: string;
        weight?: string;
        status?: string;
        locationStatus?: string;
      };
    };
    statusCode?: number;
    statusDescription?: string;
  }>(config, "transport-orders", "/tracking", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const data = res.data;
  return {
    statusDescription: res.statusDescription,
    status: data?.transportOrderData?.status,
    locationStatus: data?.transportOrderData?.locationStatus,
    service: data?.transportOrderData?.service,
    product: data?.transportOrderData?.product,
    dimensions: data?.transportOrderData?.dimensions,
    weight: data?.transportOrderData?.weight,
    certificateNumber: data?.transportOrderData?.certificateNumber,
    reference: data?.transportOrderData?.reference,
    delivery: data?.deliveryData,
    address: data?.addressData,
    events: (data?.trackingEvents ?? []).map((e) => ({
      date: e.eventDate,
      hour: e.eventHour,
      dateTime: e.eventDateTime,
      description: e.description,
      clientDescription: e.code?.clientEventDescription,
      eventCode: e.code?.eventCode,
      compEventCode: e.code?.compEventCode,
      clientEventCode: e.code?.clientEventCode,
      motive: e.motive,
      location: e.location,
      latitude: e.latitude,
      longitude: e.longitude,
      officeId: e.officeId,
      certificadoEntrega: e.certificadoEntrega,
    })),
  };
}

/**
 * Tracking en lote (hasta varias OTs en una sola request). El spec define
 * `/tracking/bulk` con body `{rut, showTrackingEvents, trackingInput[{reference,
 * transportOrderNumber}]}`. Útil para sincronizar estados de múltiples envíos
 * en un cron en vez de hacer N requests.
 */
export async function trackBulkTransportOrders(
  config: ChilexpressConfig,
  input: {
    rut: string | number;
    showTrackingEvents?: boolean;
    items: Array<{ transportOrderNumber: string | number; reference?: string }>;
  }
): Promise<CxTrackingResult[]> {
  const res = await cxFetch<{
    data?: Array<{
      addressData?: unknown;
      deliveryData?: unknown;
      trackingEvents?: unknown[];
      transportOrderData?: { transportOrderNumber?: string; status?: string };
    }>;
    statusCode?: number;
    statusDescription?: string;
  }>(config, "transport-orders", "/tracking/bulk", {
    method: "POST",
    body: JSON.stringify({
      rut: typeof input.rut === "string" ? Number(input.rut) : input.rut,
      showTrackingEvents: input.showTrackingEvents ?? true,
      trackingInput: input.items.map((it) => ({
        transportOrderNumber:
          typeof it.transportOrderNumber === "string"
            ? Number(it.transportOrderNumber)
            : it.transportOrderNumber,
        reference: it.reference ?? "",
      })),
    }),
  });
  // Cada entry en data tiene el mismo shape que /tracking. Reutilizamos el
  // mapper inline (versión más simple, sin events porque bulk suele venir sin).
  return (res.data ?? []).map((entry) => {
    const td = entry.transportOrderData as
      | { transportOrderNumber?: string; status?: string; reference?: string }
      | undefined;
    return {
      statusDescription: res.statusDescription,
      status: td?.status,
      reference: td?.reference,
      certificateNumber: undefined,
      events: [],
    } satisfies CxTrackingResult;
  });
}

// ─── Manifiesto (certificados de transporte) ──────────────────────────────────
//
// Un certificado agrupa OTs creadas el mismo día y, al cerrarse, entrega el
// PDF (base64) del manifiesto que la clínica imprime para entregar el lote al
// courier. Flujo Chilexpress:
//
//   1. POST /transport-order-certificates?customerCardNumber=TCC
//      → devuelve certificateNumber nuevo (queda OPEN).
//   2. POST /transport-orders con header.certificateNumber = ese número
//      → cada OT queda asociada al certificado (en vez de crear uno por OT).
//   3. PUT /transport-order-certificates con {certificateNumber, certificateType,
//      dropNumber} → cierra el certificado y entrega imagePdf (base64).
//   4. GET /transport-order-certificates/{certificateNumber}
//      → reconsultar manifiesto cerrado (PDF + detalle).

export interface CxCertificateDetailEntry {
  product?: string;
  service?: string;
  amount?: number;
}

export interface CxClosedCertificate {
  certificateNumber?: string;
  printedDate?: string;
  rutNumber?: number;
  businessName?: string;
  amountOfPieces?: number;
  customerCardNumber?: number;
  dropNumber?: number;
  pickupAddress?: string;
  binaryImage?: string;
  /** PDF del manifiesto cerrado, base64. */
  imagePdf?: string;
  detail?: CxCertificateDetailEntry[];
}

/** Crea un certificado nuevo (queda OPEN). Devuelve el certificateNumber. */
export async function createCertificate(
  config: ChilexpressConfig,
  customerCardNumber?: string | number
): Promise<{ certificateNumber: string; statusDescription?: string }> {
  const tcc = customerCardNumber ?? config.clientRut;
  const qs = tcc != null && String(tcc).trim() !== "" ? `?customerCardNumber=${tcc}` : "";
  const res = await cxFetch<{
    // Chilexpress devuelve certificateNumber como NÚMERO (no string) y a veces
    // anidado bajo `data`. Aceptar ambos y coercer a string.
    certificateNumber?: string | number;
    data?: { certificateNumber?: string | number };
    statusCode?: number;
    statusDescription?: string;
  }>(config, "transport-orders", `/transport-order-certificates${qs}`, {
    method: "POST",
  });
  const rawCertificateNumber = res.certificateNumber ?? res.data?.certificateNumber;
  if (res.statusCode !== 0 || rawCertificateNumber == null) {
    throw new Error(
      `Chilexpress create certificate failed: ${res.statusDescription ?? "sin detalles"}`
    );
  }
  return {
    certificateNumber: String(rawCertificateNumber),
    statusDescription: res.statusDescription,
  };
}

/**
 * Cierra el certificado y obtiene el PDF del manifiesto.
 *
 * @param certificateType 1 = imagen binaria, 2 = solo datos (sin PDF).
 * @param dropNumber Número de retiro asociado (0 si no aplica).
 */
export async function closeCertificate(
  config: ChilexpressConfig,
  input: {
    certificateNumber: string | number;
    certificateType?: 1 | 2;
    dropNumber?: number;
  }
): Promise<CxClosedCertificate> {
  const res = await cxFetch<{
    closedCertificate?: CxClosedCertificate;
    statusCode?: number;
    statusDescription?: string;
  }>(config, "transport-orders", "/transport-order-certificates", {
    method: "PUT",
    body: JSON.stringify({
      certificateNumber:
        typeof input.certificateNumber === "string"
          ? Number(input.certificateNumber)
          : input.certificateNumber,
      certificateType: input.certificateType ?? 1,
      dropNumber: input.dropNumber ?? 0,
    }),
  });
  if (res.statusCode !== 0 || !res.closedCertificate) {
    throw new Error(
      `Chilexpress close certificate failed: ${res.statusDescription ?? "sin detalles"}`
    );
  }
  return res.closedCertificate;
}

/** Reconsulta el manifiesto cerrado (PDF + detalle). */
export async function getCertificate(
  config: ChilexpressConfig,
  certificateNumber: string | number
): Promise<CxClosedCertificate> {
  const res = await cxFetch<{
    data?: CxClosedCertificate;
    statusCode?: number;
    statusDescription?: string;
  }>(config, "transport-orders", `/transport-order-certificates/${certificateNumber}`, {
    method: "GET",
  });
  if (res.statusCode !== 0 || !res.data) {
    throw new Error(
      `Chilexpress get certificate failed: ${res.statusDescription ?? "sin detalles"}`
    );
  }
  return res.data;
}
