import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type {
  ServicesContract,
  detailResponseSchema,
  listResponseSchema,
  scheduleResponseSchema,
} from "@finanzas/orpc-contracts/services";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
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

export const toServicesApiError = toApiError;
