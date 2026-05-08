import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { AddressesContract } from "@finanzas/orpc-contracts/addresses";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";

const addressesORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export type AddressesORPCClient = ContractRouterClient<AddressesContract>;

export const addressesORPCClient = createORPCClient(addressesORPCLink, {
  path: ["api", "orpc", "addresses", "rpc"],
}) as AddressesORPCClient;

export function toAddressesApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ORPCError) return new ApiError(error.message, error.status, error.data);
  if (error instanceof Error) return new ApiError(error.message, 500);
  return new ApiError("Error inesperado", 500, error);
}
