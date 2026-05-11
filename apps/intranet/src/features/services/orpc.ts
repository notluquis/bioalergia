import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import {
  detailResponseSchema,
  scheduleResponseSchema,
  type ServicesContract,
  listResponseSchema,
} from "@finanzas/orpc-contracts/services";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { z } from "zod";
import { csrfFetch } from "@/lib/csrf-fetch";

const servicesORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type ServicesORPCClient = ContractRouterClient<ServicesContract>;

export const servicesORPCClient = createORPCClient(servicesORPCLink, {
  path: ["api", "orpc", "services", "rpc"],
}) as ServicesORPCClient;

export type ServiceScheduleItemTransport = z.infer<
  typeof detailResponseSchema
>["schedules"][number];
export type ServiceScheduleTransport = z.infer<typeof scheduleResponseSchema>;
export type ServiceDetailTransport = z.infer<typeof detailResponseSchema>;
export type ServiceListTransport = z.infer<typeof listResponseSchema>;

export function toServicesApiError(error: unknown): ApiError {
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
