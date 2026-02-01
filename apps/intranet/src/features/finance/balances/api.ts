import { apiClient } from "@/lib/api-client";
import { BalancesApiResponseSchema, StatusResponseSchema } from "./schemas";
import type { BalancesApiResponse } from "./types";

export async function fetchBalances(from: string, to: string): Promise<BalancesApiResponse> {
  const params = new URLSearchParams({ from, to });
  const res = await apiClient.get<BalancesApiResponse>(`/api/balances?${params.toString()}`, {
    responseSchema: BalancesApiResponseSchema,
  });
  return res;
}

export async function saveBalance(date: string, balance: number, note?: string): Promise<void> {
  await apiClient.post(
    "/api/balances",
    {
      balance,
      date,
      note: note?.trim() ? note.trim() : undefined,
    },
    { responseSchema: StatusResponseSchema },
  );
}
