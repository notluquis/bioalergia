import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { ClinicalSkinTestsContract } from "@finanzas/orpc-contracts/clinical-skin-tests";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";

const link = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export type ClinicalSkinTestsORPCClient = ContractRouterClient<ClinicalSkinTestsContract>;

export const clinicalSkinTestsORPCClient = createORPCClient(link, {
  path: ["api", "orpc", "clinical-skin-tests", "rpc"],
}) as ClinicalSkinTestsORPCClient;

export function toClinicalSkinTestsApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ORPCError) {
    return new ApiError(error.message, error.status, error.data);
  }
  if (error instanceof Error) {
    return new ApiError(error.message, 500);
  }
  return new ApiError("Error inesperado en importación de tests cutáneos", 500);
}
