// ChileExpress REST API types

// ─── Coverage / Georeference ──────────────────────────────────────────────────

export interface CxRegion {
  regionId: string;
  regionName: string;
}

export interface CxCommune {
  countyCode: string;
  countyName: string;
  regionId: string;
  coverageRegionCode: string;
}

export interface CxCommercialOffice {
  commercialOfficeId: string;
  commercialOfficeName: string;
  street: string;
  number: string;
  commune: string;
  region: string;
  schedules: string;
  latitude?: number;
  longitude?: number;
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
    clientRut: string;
    countyOfOriginCoverageCode: string;
    labelType: number;
  };
  details: Array<{
    addresses: {
      deliveryAddress: {
        streetName: string;
        streetNumber: string;
        supplement?: string;
        county: {
          coverageRegionCode: string;
        };
        isOrigin: false;
        deliveryOnCommercialOffice: boolean;
        commercialOfficeId: string;
        observation?: string;
      };
    };
    contacts: {
      recipient: {
        name: string;
        phoneNumber: string;
        mail?: string;
      };
    };
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
    }>;
  }>;
}

export interface CxTransportOrderResult {
  otNumber: string;
  barCode: string;
  labelData?: string;
}

export interface CxTransportOrderResponse {
  data?: {
    operationDetails?: CxTransportOrderResult[];
  };
  statusCode?: number;
  message?: string;
}
