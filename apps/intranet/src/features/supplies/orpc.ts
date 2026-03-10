import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { CommonSupply, SupplyRequest } from "./types";

type SuppliesORPCClient = {
  common: () => Promise<{ commonSupplies: CommonSupply[] }>;
  createRequest: (input: {
    brand?: null | string;
    model?: null | string;
    notes?: null | string;
    quantity: number;
    supplyName: string;
  }) => Promise<{ status: "ok" }>;
  requests: () => Promise<{ requests: SupplyRequest[] }>;
  updateRequestStatus: (input: {
    id: number;
    status: SupplyRequest["status"];
  }) => Promise<{ status: "ok" }>;
};

const suppliesORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const suppliesORPCClient = createORPCClient<SuppliesORPCClient>(suppliesORPCLink, {
  path: ["api", "orpc", "supplies", "rpc"],
});

export function toSuppliesApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof ORPCError) {
    return new ApiError(error.message, error.status, error.data);
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 500);
  }

  return new ApiError("Error inesperado", 500, error);
}
