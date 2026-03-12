import { createORPCClient, ORPCError } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { RolesORPCRouter } from "../../../../api/src/orpc/roles";

type RoleMapping = {
  app_role: string;
  employee_role: string;
};

type RoleUser = {
  email: string;
  id: number;
  person: null | {
    fatherName: string;
    names: string;
  };
};

const rolesORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export type RolesORPCClient = RouterClient<RolesORPCRouter>;

export const rolesORPCClient = createORPCClient<RolesORPCClient>(rolesORPCLink, {
  path: ["api", "orpc", "roles", "rpc"],
});

export function toRolesApiError(error: unknown): ApiError {
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

export type { RoleMapping, RoleUser };
