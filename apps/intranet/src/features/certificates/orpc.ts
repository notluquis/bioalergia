import { createORPCClient, ORPCError } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { CertificatesORPCRouter } from "../../../../api/src/orpc/certificates";

const certificatesORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export type CertificatesORPCClient = RouterClient<CertificatesORPCRouter>;

export const certificatesORPCClient = createORPCClient<CertificatesORPCClient>(
  certificatesORPCLink,
  {
    path: ["api", "orpc", "certificates", "rpc"],
  }
);

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
