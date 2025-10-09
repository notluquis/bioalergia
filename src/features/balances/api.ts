import { apiClient } from "../../lib/apiClient";
import type { BalancesApiResponse } from "./types";

export async function fetchBalances(from: string, to: string): Promise<BalancesApiResponse> {
  const params = new URLSearchParams({ from, to });
  const res = await apiClient.get<BalancesApiResponse>(`/api/balances?${params.toString()}`);
  return res;
}

export async function saveBalance(date: string, balance: number, note?: string): Promise<void> {
  await apiClient.post("/api/balances", {
    date,
    balance,
    note: note?.trim() ? note.trim() : undefined,
  });
}
