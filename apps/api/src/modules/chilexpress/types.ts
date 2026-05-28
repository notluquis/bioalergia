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
    // Spec declara string con punto. Aceptamos number (se serializa antes de
    // mandar) o string ya pre-formateado.
    weight: number | string;
    height: number | string;
    width: number | string;
    length: number | string;
  };
  productType: number;
  contentType: number;
  declaredWorth: string;
  deliveryTime: number;
  /**
   * TCC del cliente. Si está presente, se usa /rates/business y la respuesta
   * incluye `serviceValueDiscount` con el precio con descuento de empresa.
   */
  customerCardNumber?: string;
}

export interface CxServiceOption {
  serviceTypeCode: string | number;
  serviceDescription: string;
  // Spec: string ("8569"). Algunos callers reciben number tras coerción Zod
  // upstream; aceptamos ambos.
  serviceValue: number | string;
  /** Precio final con descuento de empresa (solo /rates/business). */
  serviceValueDiscount?: number | string;
  finalWeight?: number | string;
  didUseVolumetricWeight?: boolean | string;
  conditions?: string;
  deliveryType?: number;
  deliveryTime?: string;
}

export interface CxRateResponse {
  data?: {
    courierServiceOptions?: CxServiceOption[];
  };
  statusCode?: number;
  statusDescription?: string;
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
      // Chilexpress exige exactamente "Dest" (destinatario) o "Dev"
      // (devolución) — capitalizado así, NO en mayúsculas ("DEST" → 400
      // "ingrese el tipo de dirección correctamente como Dev o Dest").
      addressType: "Dest" | "Dev";
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
      /**
       * Referencia única del envío (identifica este bulto en tracking + cierre
       * de certificado). Spec marca obligatorio.
       */
      deliveryReference: string;
      /**
       * Referencia del grupo de bultos. Para envíos de un solo bulto, igual
       * a deliveryReference. Spec marca obligatorio.
       */
      groupReference: string;
      /**
       * Código del tipo de producto enviado (declaredContent). Spec:
       * 1 = Artículos Personales, 2 = Educación, 4 = Vestuario, 5 = Otros,
       * 7 = Tecnología, 10000331 = Celular.
       */
      declaredContent?: string;
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
  // Cuando un detalle falla, Chilexpress devuelve el motivo a nivel de detalle
  // (el statusDescription top-level solo dice "ninguno fue exitoso"). Estos
  // campos traen la causa accionable (cobertura inválida, servicio no
  // habilitado para el destino, peso/dimensión fuera de rango, etc).
  statusCode?: number;
  statusDescription?: string;
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
