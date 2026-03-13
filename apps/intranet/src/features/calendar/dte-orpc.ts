import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { DteEventLinksContract } from "@finanzas/orpc-contracts/dte-event-links";
import { SuperJSONLink } from "./orpc";

export type DteEventLinksORPCClient = ContractRouterClient<DteEventLinksContract>;

const dteEventLinksORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const dteEventLinksORPCClient = createORPCClient<DteEventLinksORPCClient>(
  dteEventLinksORPCLink,
  {
    path: ["api", "orpc", "dte-analytics", "event-links", "rpc"],
  }
);
