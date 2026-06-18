import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { UsersContract } from "@finanzas/orpc-contracts/users";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type UsersORPCClient = ContractRouterClient<UsersContract>;

const usersORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const usersORPCClient = createORPCClient(usersORPCLink, {
  path: ["api", "orpc", "users", "rpc"],
}) as UsersORPCClient;

export const toUsersApiError = toApiError;
