import type { HaulmerDteContract } from "@finanzas/orpc-contracts/haulmer-dte";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";

const link = new RPCLink({
  url: () => `${window.location.origin}/api/orpc/haulmer-dte/rpc`,
  fetch: (req: Request) => fetch(req, { credentials: "include" }),
});

export const haulmerDteClient: ContractRouterClient<HaulmerDteContract> = createORPCClient(link);
