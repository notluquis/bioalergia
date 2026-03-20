import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type {
  RolesContract,
  rolesRoleMappingSchema,
  rolesRoleUserSchema,
} from "@finanzas/orpc-contracts/roles";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { z } from "zod";

export type RolesORPCClient = ContractRouterClient<RolesContract>;
type RoleMapping = z.infer<typeof rolesRoleMappingSchema>;
type RoleUser = z.infer<typeof rolesRoleUserSchema>;

const rolesORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const rolesORPCClient = createORPCClient(rolesORPCLink, {
  path: ["api", "orpc", "roles", "rpc"],
}) as RolesORPCClient;

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
