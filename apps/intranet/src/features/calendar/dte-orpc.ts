import { createORPCClient } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import type { DteEventLinksORPCRouter } from "../../../../api/src/orpc/dte-event-links";
import { SuperJSONLink } from "./orpc";

export type DteEventLinksORPCClient = RouterClient<DteEventLinksORPCRouter>;

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
