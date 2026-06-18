import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { CertificatesContract } from "@finanzas/orpc-contracts/certificates";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type CertificatesORPCClient = ContractRouterClient<CertificatesContract>;

const certificatesORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const certificatesORPCClient = createORPCClient(certificatesORPCLink, {
  path: ["api", "orpc", "certificates", "rpc"],
}) as CertificatesORPCClient;

export const toCertificatesApiError = toApiError;
