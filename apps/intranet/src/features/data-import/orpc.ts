import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { CsvUploadContract, csvUploadTableSchema } from "@finanzas/orpc-contracts/csv-upload";
import type { z } from "zod";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
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

export const toCsvUploadApiError = toApiError;
