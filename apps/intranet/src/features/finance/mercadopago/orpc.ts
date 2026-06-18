import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { MercadopagoContract } from "@finanzas/orpc-contracts/mercadopago";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const mercadopagoORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type MercadopagoORPCClient = ContractRouterClient<MercadopagoContract>;

export const mercadopagoORPCClient = createORPCClient(mercadopagoORPCLink, {
  path: ["api", "orpc", "mercadopago", "rpc"],
}) as MercadopagoORPCClient;

export const toMercadoPagoApiError = toApiError;
