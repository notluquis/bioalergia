import { createORPCClient, ORPCError } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { DoctoraliaORPCRouter } from "../../../../api/src/orpc/doctoralia";

export type DoctoraliaORPCClient = RouterClient<DoctoraliaORPCRouter>;

const doctoraliaORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const doctoraliaORPCClient = createORPCClient<DoctoraliaORPCClient>(doctoraliaORPCLink, {
  path: ["api", "orpc", "doctoralia", "rpc"],
});

export function toDoctoraliaApiError(error: unknown): ApiError {
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
