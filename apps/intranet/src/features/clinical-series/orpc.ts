import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type {
  ClinicalSeriesFilters,
  ClinicalSeriesSnapshot,
  RebuildSeriesParams,
  RebuildSeriesResult,
} from "./types";

type ClinicalSeriesORPCClient = {
  detail: (input: { id: number }) => Promise<ClinicalSeriesSnapshot>;
  list: (input?: ClinicalSeriesFilters) => Promise<ClinicalSeriesSnapshot[]>;
  rebuild: (input?: RebuildSeriesParams) => Promise<RebuildSeriesResult>;
};

const clinicalSeriesORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const clinicalSeriesORPCClient = createORPCClient<ClinicalSeriesORPCClient>(
  clinicalSeriesORPCLink,
  {
    path: ["api", "orpc", "clinical-series", "rpc"],
  },
);

export function toClinicalSeriesApiError(error: unknown): ApiError {
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
