import { csrfFetch, SuperJSONLink } from "@finanzas/orpc-client";

export const siteSuperJSONLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});
