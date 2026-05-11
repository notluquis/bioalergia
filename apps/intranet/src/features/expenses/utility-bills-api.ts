import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { UtilityBillsContract } from "@finanzas/orpc-contracts/utility-bills";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const link = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

const client = createORPCClient(link, {
  path: ["api", "orpc", "utility-bills", "rpc"],
}) as ContractRouterClient<UtilityBillsContract>;

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ORPCError) return new ApiError(error.message, error.status, error.data);
  if (error instanceof Error) return new ApiError(error.message, 500);
  return new ApiError("Error inesperado", 500, error);
}

export interface EssbioBillResult {
  accountNumber: string;
  address: string;
  clientName: string;
  company: string;
  currentDebt: number;
  error: null | string;
  lastPayment: { amount: number; date: string } | null;
  observation: string | null;
  previousBalance: number;
  regulated: boolean;
}

export interface CgeBillResult {
  accountNumber: string;
  address: string;
  clientName: string;
  commune: string;
  company: string;
  currentBill: number;
  emissionDate: string;
  previousBill: number;
  thirdBill: number;
}

export async function fetchEssbioBill(serviceNumber: string): Promise<EssbioBillResult> {
  try {
    const result = await client.fetchEssbio({ serviceNumber });
    return result.bill as EssbioBillResult;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function fetchCgeBill(accountNumber: string): Promise<CgeBillResult> {
  try {
    const result = await client.fetchCge({ accountNumber });
    return result.bill as CgeBillResult;
  } catch (error) {
    throw toApiError(error);
  }
}
