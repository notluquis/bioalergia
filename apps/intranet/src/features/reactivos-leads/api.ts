import type { UpdateReactivoLeadStatusInput } from "@finanzas/orpc-contracts/reactivos";
import { reactivosORPCClient, toReactivosApiError } from "./orpc";

// ── Query keys ────────────────────────────────────────────────────────
export const leadsKeys = {
  all: ["reactivos-leads"] as const,
  list: () => [...leadsKeys.all, "list"] as const,
};

// ── Wrappers ──────────────────────────────────────────────────────────
export async function listLeads() {
  try {
    const res = await reactivosORPCClient.listLeads();
    return res.leads;
  } catch (error) {
    throw toReactivosApiError(error);
  }
}

export async function updateLeadStatus(input: UpdateReactivoLeadStatusInput) {
  try {
    const res = await reactivosORPCClient.updateLeadStatus(input);
    return res.lead;
  } catch (error) {
    throw toReactivosApiError(error);
  }
}
