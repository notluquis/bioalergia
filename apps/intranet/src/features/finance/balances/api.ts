import { balancesORPCClient, toBalancesApiError } from "./orpc";
import { BalancesApiResponseSchema, StatusResponseSchema } from "./schemas";
import type { BalancesApiResponse } from "./types";

export async function fetchBalances(from: string, to: string): Promise<BalancesApiResponse> {
  try {
    return BalancesApiResponseSchema.parse(await balancesORPCClient.list({ from, to }));
  } catch (error) {
    throw toBalancesApiError(error);
  }
}

export async function saveBalance(date: string, balance: number, note?: string): Promise<void> {
  try {
    StatusResponseSchema.parse(
      await balancesORPCClient.save({
        balance,
        date,
        note: note?.trim() ? note.trim() : undefined,
      })
    );
  } catch (error) {
    throw toBalancesApiError(error);
  }
}
