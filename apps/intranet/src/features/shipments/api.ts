import { shipmentsORPCClient, toShipmentsApiError } from "./orpc";

export async function fetchRegions() {
  try {
    return await shipmentsORPCClient.getRegions({});
  } catch (error) {
    throw toShipmentsApiError(error);
  }
}

export async function fetchCommunes(regionId: string, type?: "1" | "2") {
  try {
    return await shipmentsORPCClient.getCommunes({ regionId, type });
  } catch (error) {
    throw toShipmentsApiError(error);
  }
}

export async function fetchCommercialOffices(options: {
  regionCode: string;
  countyName: string;
  type?: "0" | "4";
}) {
  try {
    return await shipmentsORPCClient.getCommercialOffices(options);
  } catch (error) {
    throw toShipmentsApiError(error);
  }
}

export async function fetchNearbyOffices(addressId: number) {
  try {
    return await shipmentsORPCClient.getNearbyOffices({ addressId });
  } catch (error) {
    throw toShipmentsApiError(error);
  }
}

export async function searchStreets(input: { countyName: string; query: string }) {
  try {
    return await shipmentsORPCClient.searchStreets(input);
  } catch (error) {
    throw toShipmentsApiError(error);
  }
}

export async function getStreetNumbers(streetNameId: number) {
  try {
    return await shipmentsORPCClient.getStreetNumbers({ streetNameId });
  } catch (error) {
    throw toShipmentsApiError(error);
  }
}

export async function geocodeAddress(input: {
  streetName: string;
  countyName: string;
  number: string;
}) {
  try {
    return await shipmentsORPCClient.geocodeAddress(input);
  } catch (error) {
    throw toShipmentsApiError(error);
  }
}

export async function reprintLabel(shipmentId: number) {
  try {
    return await shipmentsORPCClient.reprintLabel({ shipmentId });
  } catch (error) {
    throw toShipmentsApiError(error);
  }
}

export async function trackShipment(shipmentId: number) {
  try {
    return await shipmentsORPCClient.trackShipment({ shipmentId });
  } catch (error) {
    throw toShipmentsApiError(error);
  }
}

export async function refreshAllTracking() {
  try {
    return await shipmentsORPCClient.refreshAllTracking({});
  } catch (error) {
    throw toShipmentsApiError(error);
  }
}

export async function quoteShipment(input: {
  originCoverageCode: string;
  destinationCoverageCode: string;
  weight: number;
  height: number;
  width: number;
  length: number;
  declaredValue: number;
}) {
  try {
    return await shipmentsORPCClient.quote(input);
  } catch (error) {
    throw toShipmentsApiError(error);
  }
}

export async function createShipment(input: {
  patientId: number;
  deliveryMode?: "home" | "office";
  addressId?: number;
  serviceTypeCode: string;
  serviceDescription: string;
  destinationCoverageCode: string;
  commercialOfficeId?: string;
  commercialOfficeName?: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail?: string;
  weight: number;
  height: number;
  width: number;
  length: number;
  declaredValue: number;
  cashOnDelivery: number;
  contentDescription: string;
  additionalServiceCodes?: number[];
  additionalServicesCost?: number;
}) {
  try {
    return await shipmentsORPCClient.create(input);
  } catch (error) {
    throw toShipmentsApiError(error);
  }
}

export async function fetchShipments(patientId: number) {
  try {
    return await shipmentsORPCClient.list({ patientId });
  } catch (error) {
    throw toShipmentsApiError(error);
  }
}

export async function fetchAllShipments() {
  try {
    return await shipmentsORPCClient.listAll({});
  } catch (error) {
    throw toShipmentsApiError(error);
  }
}

// ─── Manifiesto (certificado de transporte del día) ───────────────────────────

export async function fetchActiveManifest() {
  try {
    return await shipmentsORPCClient.getActiveCertificate({});
  } catch (error) {
    throw toShipmentsApiError(error);
  }
}

export async function openManifest() {
  try {
    return await shipmentsORPCClient.openCertificate({});
  } catch (error) {
    throw toShipmentsApiError(error);
  }
}

export async function closeManifest(input?: {
  certificateNumber?: string | number;
  certificateType?: 1 | 2;
  dropNumber?: number;
}) {
  try {
    return await shipmentsORPCClient.closeCertificate(input ?? {});
  } catch (error) {
    throw toShipmentsApiError(error);
  }
}

export async function fetchManifestCertificate(certificateNumber: string) {
  try {
    return await shipmentsORPCClient.getCertificate({ certificateNumber });
  } catch (error) {
    throw toShipmentsApiError(error);
  }
}
