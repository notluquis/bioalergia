import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { CatalogContract } from "@finanzas/orpc-contracts/catalog";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type CatalogORPCClient = ContractRouterClient<CatalogContract>;

const catalogORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const catalogORPCClient = createORPCClient(catalogORPCLink, {
  path: ["api", "orpc", "catalog", "rpc"],
}) as CatalogORPCClient;

export function toCatalogApiError(error: unknown): ApiError {
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
