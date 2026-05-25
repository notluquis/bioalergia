// ChileExpress REST API types

// ─── Coverage / Georeference ──────────────────────────────────────────────────

export interface CxRegion {
  regionId: string;
  regionName: string;
}

export interface CxCommune {
  countyCode: string;
  countyName: string;
  regionCode: string;
  ineCountyCode?: number;
  coverageName?: string;
  /** 1 = la comuna acepta envíos "Por Pagar Destino" (cash on delivery). */
  supportsCashOnDelivery: boolean;
  /** 1 = retorno habilitado. */
  supportsReturn: boolean;
  // Aliases the rest of the codebase already expects.
  regionId: string;
  coverageRegionCode: string;
}

export interface CxOfficeBusinessHour {
  day: string;
  initialStartHour: string;
  initialEndHour: string;
  finalStartHour: string;
  finalEndHour: string;
}

export interface CxOfficeService {
  serviceTypeCode: number;
  serviceDescription: string;
  /** 1 = activo, 0 = no disponible. */
  serviceStatusCode: number;
}

export interface CxCommercialOffice {
  commercialOfficeId: string;
  commercialOfficeName: string;
  /** 3 = sucursal propia, 4 = pickup partner. */
  officeType: number;
  street: string;
  number: string;
  complement?: string;
  commune: string;
  region: string;
  regionCode: string;
  countyCode?: string;
  manager?: string;
  phone?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  /** Distance in km from queried address (when available). */
  distance?: number;
  /** Códigos numéricos internos. */
  officeCode?: number;
  ineCountyId?: number;
  /** Per-day schedule including split shifts. */
  businessHour: CxOfficeBusinessHour[];
  /** Available services and their on/off status. */
  services: CxOfficeService[];
  /** Comma-joined human-readable schedule for legacy callers. */
  schedules: string;
}

// ─── Rating ──────────────────────────────────────────────────────────────────

export interface CxRateInput {
  originCountyCode: string;
  destinationCountyCode: string;
  package: {
    weight: number;
    height: number;
    width: number;
    length: number;
  };
  productType: number;
  contentType: number;
  declaredWorth: string;
  deliveryTime: number;
}

export interface CxServiceOption {
  serviceTypeCode: string;
  serviceDescription: string;
  serviceValue: number;
  deliveryTime?: string;
}

export interface CxRateResponse {
  data?: {
    courierServiceOptions?: CxServiceOption[];
  };
  statusCode?: number;
  message?: string;
}

// ─── Transport Orders ─────────────────────────────────────────────────────────

export interface CxTransportOrderInput {
  header: {
    certificateNumber: number;
    // Número de Tarjeta Cliente Chilexpress (TCC). La API lo exige como
    // `customerCardNumber`; enviarlo como `clientRut` provoca 400.
    customerCardNumber: string;
    countyOfOriginCoverageCode: string;
    labelType: number;
  };
  details: Array<{
    // ChileExpress espera arrays (IList<...>), no objetos con keys nombradas.
    addresses: Array<{
      // Código de cobertura de la comuna destino (campo plano, no anidado).
      countyCoverageCode: string;
      streetName: string;
      streetNumber: string;
      supplement?: string;
      // "DEST" = dirección destino, "DEV" = dirección devolución.
      addressType: "DEST" | "DEV";
      deliveryOnCommercialOffice: boolean;
      commercialOfficeId: string;
      observation?: string;
    }>;
    contacts: Array<{
      name: string;
      phoneNumber: string;
      mail?: string;
      // "D" = destinatario, "R" = remitente.
      contactType: "D" | "R";
    }>;
    packages: Array<{
      weight: number;
      height: number;
      width: number;
      length: number;
      serviceDeliveryCode: string;
      declaredValue: string;
      cashOnDelivery: string;
      descriptionOfContent: string;
      productCode: string;
      multivariateCode: string;
      numberOfPackages: number;
      /** Add-on services per package (e.g. 417 = Cobertura Extendida). */
      additionalServices?: Array<{ serviceTypeCode: number }>;
    }>;
  }>;
}

/**
 * Per the live Chilexpress response from /transport-orders/api/v1.0/transport-orders:
 * {
 *   data: {
 *     header: { certificateNumber: number },
 *     detail: [
 *       {
 *         transportOrderNumber: string,
 *         reference: string,
 *         serviceDescriptionFull: string,
 *         barcode: string,
 *         label?: { labelData: string, labelType: number }
 *       }
 *     ]
 *   },
 *   statusCode: number,
 *   statusDescription: string,
 * }
 */
export interface CxTransportOrderResult {
  transportOrderNumber: string;
  reference?: string;
  serviceDescriptionFull?: string;
  barcode: string;
  label?: {
    labelData: string;
    labelType: number;
  };
}

export interface CxTransportOrderResponse {
  data?: {
    header?: { certificateNumber: number };
    detail?: CxTransportOrderResult[];
  };
  statusCode?: number;
  statusDescription?: string;
  message?: string;
}

// ─── Reprint Label ────────────────────────────────────────────────────────────

export interface CxReprintLabelInput {
  transportOrderNumber: string;
  /** 1 = etiqueta normal, 2 = térmica, etc. Default 2 ya en uso. */
  labelType?: number;
  reportType?: number;
}

export interface CxReprintLabelResponse {
  data?: {
    detail?: {
      transportOrderNumber: string;
      reference?: string;
      barcode?: string;
    };
    label?: string; // base64
  };
  statusCode?: number;
  statusDescription?: string;
  message?: string;
}

// ─── Tracking ─────────────────────────────────────────────────────────────────

export interface CxTrackingInput {
  transportOrderNumber: string;
}

export interface CxTrackingEvent {
  eventDate?: string;
  eventName?: string;
  eventLocation?: string;
}

export interface CxTrackingResponse {
  data?: {
    transportOrderNumber?: string;
    statusCodeReference?: string;
    statusDescription?: string;
    events?: CxTrackingEvent[];
  };
  statusCode?: number;
  statusDescription?: string;
  message?: string;
}

// ─── Nearby Offices ───────────────────────────────────────────────────────────

export interface CxNearbyOffice {
  distance: string; // km
  office: CxCommercialOffice;
}

// ─── Streets autocomplete ────────────────────────────────────────────────────

export interface CxStreet {
  streetNameId: number;
  streetName: string;
  countyName?: string;
  regionName?: string;
}

export interface CxStreetNumber {
  streetNumber: number;
  addressId: number;
}

// ─── Geocoding ────────────────────────────────────────────────────────────────

export interface CxGeocodeInput {
  streetName: string;
  countyName: string;
  number: string;
}

export interface CxGeocodeResponse {
  data?: {
    streetName?: string;
    countyName?: string;
    number?: string;
    latitude?: string;
    longitude?: string;
    addressId?: number;
  };
  statusCode?: number;
  statusDescription?: string;
}
