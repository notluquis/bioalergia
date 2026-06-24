import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { OneDriveContract } from "@finanzas/orpc-contracts/onedrive";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { csrfFetch } from "@/lib/csrf-fetch";

// Generic OneDrive account / folder / webhook client. Mirrors the skin-test
// client setup but targets the shared /api/orpc/onedrive router, so any
// feature (skin-tests, fichas) drives OneDrive through the same module.

const link = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type OneDriveORPCClient = ContractRouterClient<OneDriveContract>;

export const onedriveORPCClient = createORPCClient(link, {
  path: ["api", "orpc", "onedrive", "rpc"],
}) as OneDriveORPCClient;
