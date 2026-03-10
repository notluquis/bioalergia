import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";

type CsvUploadORPCClient = {
  import: (input: {
    data: Record<string, number | string>[];
    mode?: "insert-only" | "insert-or-update" | "update-only";
    table: string;
  }) => Promise<{
    errors?: string[];
    inserted: number;
    skipped: number;
    status: "ok";
    toInsert: number;
    toSkip: number;
    toUpdate: number;
    updated: number;
  }>;
  preview: (input: {
    data: Record<string, number | string>[];
    includeInsertRowIndexes?: boolean;
    includeUpdateRows?: boolean;
    mode?: "insert-only" | "insert-or-update" | "update-only";
    table: string;
  }) => Promise<{
    errors?: string[];
    insertRowIndexes?: number[];
    status: "ok";
    toInsert: number;
    toSkip: number;
    toUpdate: number;
    updateRows?: Array<{ key: string; rowIndex: number; summary: string }>;
  }>;
};

const csvUploadORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

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
