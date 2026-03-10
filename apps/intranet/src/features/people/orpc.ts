import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { PersonWithExtras } from "./api";

type PeopleORPCClient = {
  detail: (input: { id: number }) => Promise<{ person: PersonWithExtras }>;
  list: (input?: {
    includeTest?: boolean;
  }) => Promise<{ people: PersonWithExtras[]; status: "ok" }>;
};

const peopleORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const peopleORPCClient = createORPCClient<PeopleORPCClient>(peopleORPCLink, {
  path: ["api", "orpc", "people", "rpc"],
});

export function toPeopleApiError(error: unknown): ApiError {
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
