import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { DteEventLinksContract } from "@finanzas/orpc-contracts/dte-event-links";
import { SuperJSONLink } from "./orpc";
import { csrfFetch } from "@/lib/csrf-fetch";

export type DteEventLinksORPCClient = ContractRouterClient<DteEventLinksContract>;

const dteEventLinksORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const dteEventLinksORPCClient = createORPCClient<DteEventLinksORPCClient>(
  dteEventLinksORPCLink,
  {
    path: ["api", "orpc", "dte-analytics", "event-links", "rpc"],
  }
);
