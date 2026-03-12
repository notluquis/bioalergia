import { createORPCClient, ORPCError } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { ServicesORPCRouter } from "../../../../api/src/orpc/services";

export type ServicesORPCClient = RouterClient<ServicesORPCRouter>;

const servicesORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const servicesORPCClient = createORPCClient<ServicesORPCClient>(servicesORPCLink, {
  path: ["api", "orpc", "services", "rpc"],
});

export type ServiceDetailTransport = Awaited<ReturnType<ServicesORPCClient["detail"]>>;
export type ServiceListTransport = Awaited<ReturnType<ServicesORPCClient["list"]>>;
export type ServiceScheduleTransport = Awaited<ReturnType<ServicesORPCClient["schedulePay"]>>;
export type ServiceScheduleItemTransport = ServiceDetailTransport["schedules"][number];

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
