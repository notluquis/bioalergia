import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { CsvUploadContract } from "@finanzas/orpc-contracts/csv-upload";
import type { z } from "zod";
import { csvUploadTableSchema } from "@finanzas/orpc-contracts/csv-upload";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type CsvUploadORPCClient = ContractRouterClient<CsvUploadContract>;

const csvUploadORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const csvUploadORPCClient = createORPCClient(csvUploadORPCLink, {
  path: ["api", "orpc", "csv-upload", "rpc"],
}) as CsvUploadORPCClient;

export type CsvImportTable = z.infer<typeof csvUploadTableSchema>;

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
