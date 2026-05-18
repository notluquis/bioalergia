import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { ImagesContract } from "@finanzas/orpc-contracts/images";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { csrfFetch } from "@/lib/csrf-fetch";

export type ImagesORPCClient = ContractRouterClient<ImagesContract>;

const link = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const imagesORPCClient = createORPCClient(link, {
  path: ["api", "orpc", "images", "rpc"],
}) as ImagesORPCClient;
