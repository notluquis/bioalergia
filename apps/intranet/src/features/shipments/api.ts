import { shipmentsORPCClient, toShipmentsApiError } from "./orpc";

export async function fetchRegions() {
  try {
    return await shipmentsORPCClient.getRegions({});
  } catch (error) {
    throw toShipmentsApiError(error);
  }
}

export async function fetchCommunes(regionId: string) {
  try {
    return await shipmentsORPCClient.getCommunes({ regionId });
  } catch (error) {
    throw toShipmentsApiError(error);
  }
}

export async function fetchCommercialOffices(coverageRegionCode: string) {
  try {
    return await shipmentsORPCClient.getCommercialOffices({ coverageRegionCode });
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
  serviceTypeCode: string;
  serviceDescription: string;
  destinationCoverageCode: string;
  commercialOfficeId: string;
  commercialOfficeName: string;
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
