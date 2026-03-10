import { z } from "zod";
import { suppliesORPCClient, toSuppliesApiError } from "./orpc";
import type { CommonSupply, SupplyRequest } from "./types";

export interface SupplyRequestPayload {
  brand?: string;
  model?: string;
  notes?: string;
  quantity: number;
  supplyName: string;
}

const StatusResponseSchema = z.looseObject({ status: z.string().optional() });
const CommonSuppliesSchema = z.array(z.unknown());
const SupplyRequestsSchema = z.array(z.unknown());

export async function createSupplyRequest(payload: SupplyRequestPayload): Promise<void> {
  try {
    StatusResponseSchema.parse(await suppliesORPCClient.createRequest(payload));
  } catch (error) {
    throw toSuppliesApiError(error);
  }
}

export async function getCommonSupplies(): Promise<CommonSupply[]> {
  try {
    const response = z
      .object({
        commonSupplies: CommonSuppliesSchema,
      })
      .parse(await suppliesORPCClient.common());

    return response.commonSupplies as CommonSupply[];
  } catch (error) {
    throw toSuppliesApiError(error);
  }
}

export async function getSupplyRequests(): Promise<SupplyRequest[]> {
  try {
    const response = z
      .object({
        requests: SupplyRequestsSchema,
      })
      .parse(await suppliesORPCClient.requests());

    return response.requests as SupplyRequest[];
  } catch (error) {
    throw toSuppliesApiError(error);
  }
}

export async function updateSupplyRequestStatus(
  requestId: number,
  status: SupplyRequest["status"],
): Promise<void> {
  try {
    StatusResponseSchema.parse(
      await suppliesORPCClient.updateRequestStatus({ id: requestId, status }),
    );
  } catch (error) {
    throw toSuppliesApiError(error);
  }
}
