import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type {
  RolesContract,
  rolesRoleMappingSchema,
  rolesRoleUserSchema,
} from "@finanzas/orpc-contracts/roles";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import type { z } from "zod";
import { csrfFetch } from "@/lib/csrf-fetch";

export type RolesORPCClient = ContractRouterClient<RolesContract>;
type RoleMapping = z.infer<typeof rolesRoleMappingSchema>;
type RoleUser = z.infer<typeof rolesRoleUserSchema>;

const rolesORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const rolesORPCClient = createORPCClient(rolesORPCLink, {
  path: ["api", "orpc", "roles", "rpc"],
}) as RolesORPCClient;

export const toRolesApiError = toApiError;

export type { RoleMapping, RoleUser };
