import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { CertificatesContract } from "@finanzas/orpc-contracts/certificates";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";

export type CertificatesORPCClient = ContractRouterClient<CertificatesContract>;

const certificatesORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const certificatesORPCClient = createORPCClient(certificatesORPCLink, {
  path: ["api", "orpc", "certificates", "rpc"],
}) as CertificatesORPCClient;

export function toCertificatesApiError(error: unknown): ApiError {
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
