import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { MercadopagoContract } from "@finanzas/orpc-contracts/mercadopago";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";

const mercadopagoORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export type MercadopagoORPCClient = ContractRouterClient<MercadopagoContract>;

export const mercadopagoORPCClient = createORPCClient(mercadopagoORPCLink, {
  path: ["api", "orpc", "mercadopago", "rpc"],
}) as MercadopagoORPCClient;

export function toMercadoPagoApiError(error: unknown): ApiError {
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
