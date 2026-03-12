import { createORPCClient, ORPCError } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { CsvUploadORPCRouter } from "../../../../api/src/orpc/csv-upload";

const csvUploadORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export type CsvUploadORPCClient = RouterClient<CsvUploadORPCRouter>;

export const csvUploadORPCClient = createORPCClient<CsvUploadORPCClient>(csvUploadORPCLink, {
  path: ["api", "orpc", "csv-upload", "rpc"],
});

export function toCsvUploadApiError(error: unknown): ApiError {
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
