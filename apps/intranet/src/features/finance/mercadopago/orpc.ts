import { createORPCClient, ORPCError } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { MercadopagoORPCRouter } from "../../../../../api/src/orpc/mercadopago";

export type MercadoPagoORPCClient = RouterClient<MercadopagoORPCRouter>;

const mercadopagoORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const mercadopagoORPCClient = createORPCClient<MercadoPagoORPCClient>(mercadopagoORPCLink, {
  path: ["api", "orpc", "mercadopago", "rpc"],
});

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
