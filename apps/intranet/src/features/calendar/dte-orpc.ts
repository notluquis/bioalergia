import { createORPCClient } from "@orpc/client";
import { SuperJSONLink } from "./orpc";
import type { UnsafeORPCClient } from "@/lib/orpc-client";

const dteEventLinksORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const dteEventLinksORPCClient = createORPCClient(dteEventLinksORPCLink, {
  path: ["api", "orpc", "dte-analytics", "event-links", "rpc"],
}) as unknown as UnsafeORPCClient;
