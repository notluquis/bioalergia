import { createORPCClient, ORPCError } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { PatientsORPCRouter } from "../../../../api/src/orpc/patients";

export type PatientsORPCClient = RouterClient<PatientsORPCRouter>;

const patientsORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const patientsORPCClient = createORPCClient<PatientsORPCClient>(patientsORPCLink, {
  path: ["api", "orpc", "patients", "rpc"],
});

export function toPatientsApiError(error: unknown): ApiError {
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
