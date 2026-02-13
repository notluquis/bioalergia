import { z } from "zod";
import { apiClient } from "@/lib/api-client";

import type {
  Counterpart,
  CounterpartAccount,
  CounterpartAccountSuggestion,
  CounterpartCategory,
  CounterpartSummary,
  UnassignedPayoutAccount,
} from "./types";

const AccountsResponseSchema = z.object({
  accounts: z.array(z.unknown()),
});

const CounterpartResponseSchema = z.object({
  accounts: z.array(z.unknown()),
  counterpart: z.unknown(),
});

const SuggestionsResponseSchema = z.object({
  suggestions: z.array(z.unknown()),
});

const CounterpartsResponseSchema = z.object({
  counterparts: z.array(z.unknown()),
});

const SummaryResponseSchema = z.object({
  summary: z.unknown(),
});

const CounterpartsSyncResponseSchema = z.object({
  conflictCount: z.number().optional(),
  syncedAccounts: z.number(),
  syncedCounterparts: z.number(),
});

const UnassignedPayoutAccountsResponseSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  rows: z.array(z.unknown()),
  total: z.number(),
});

const AssignRutToPayoutsResponseSchema = z.object({
  assignedCount: z.number(),
  conflicts: z.array(z.unknown()),
  counterpart: z.unknown(),
});

const StatusResponseSchema = z.looseObject({ status: z.string().optional() });

export interface CounterpartUpsertPayload {
  identificationNumber: string;
  bankAccountHolder: string;
  category?: CounterpartCategory;
  notes?: null | string;
}

export async function addCounterpartAccount(
  counterpartId: number,
  payload: {
    accountNumber: string;
    accountType?: null | string;
    bankName?: null | string;
  },
) {
  const data = await apiClient.post<{ accounts: CounterpartAccount[] }>(
    `/api/counterparts/${counterpartId}/accounts`,
    payload,
    { responseSchema: AccountsResponseSchema },
  );
  return data.accounts;
}

export async function attachCounterpartRut(counterpartId: number, rut: string) {
  const data = await apiClient.post<{ accounts: CounterpartAccount[] }>(
    `/api/counterparts/${counterpartId}/attach-rut`,
    { rut },
    { responseSchema: AccountsResponseSchema },
  );
  return data.accounts;
}

export async function createCounterpart(payload: CounterpartUpsertPayload) {
  return await apiClient.post<{ accounts: CounterpartAccount[]; counterpart: Counterpart }>(
    "/api/counterparts",
    payload,
    { responseSchema: CounterpartResponseSchema },
  );
}

export async function fetchAccountSuggestions(query: string, limit = 10) {
  const params = new URLSearchParams();
  if (query) {
    params.set("q", query);
  }
  params.set("limit", String(limit));
  const data = await apiClient.get<{ suggestions: CounterpartAccountSuggestion[] }>(
    `/api/counterparts/suggestions?${params.toString()}`,
    { responseSchema: SuggestionsResponseSchema },
  );
  return data.suggestions;
}

export async function fetchCounterpart(id: number) {
  return await apiClient.get<{ accounts: CounterpartAccount[]; counterpart: Counterpart }>(
    `/api/counterparts/${id}`,
    { responseSchema: CounterpartResponseSchema },
  );
}

export async function fetchCounterparts() {
  const data = await apiClient.get<{ counterparts: Counterpart[] }>("/api/counterparts", {
    responseSchema: CounterpartsResponseSchema,
  });
  return data.counterparts;
}

export async function syncCounterparts() {
  return await apiClient.post<{
    conflictCount?: number;
    syncedAccounts: number;
    syncedCounterparts: number;
  }>("/api/counterparts/sync", {}, { responseSchema: CounterpartsSyncResponseSchema });
}

export async function fetchUnassignedPayoutAccounts(params?: {
  page?: number;
  pageSize?: number;
  query?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.query?.trim()) {
    searchParams.set("q", params.query.trim());
  }
  searchParams.set("page", String(params?.page ?? 1));
  searchParams.set("pageSize", String(params?.pageSize ?? 20));
  const data = await apiClient.get<{
    page: number;
    pageSize: number;
    rows: UnassignedPayoutAccount[];
    total: number;
  }>(`/api/counterparts/unassigned-payout-accounts?${searchParams.toString()}`, {
    responseSchema: UnassignedPayoutAccountsResponseSchema,
  });
  return data;
}

export async function assignRutToPayouts(payload: {
  accountNumbers: string[];
  bankAccountHolder?: string;
  rut: string;
}) {
  return await apiClient.post<{
    assignedCount: number;
    conflicts: UnassignedPayoutAccount[];
    counterpart: Counterpart;
  }>("/api/counterparts/assign-rut-to-payouts", payload, {
    responseSchema: AssignRutToPayoutsResponseSchema,
  });
}

export async function fetchCounterpartSummary(
  counterpartId: number,
  params?: { from?: string; to?: string },
) {
  const search = new URLSearchParams();
  if (params?.from) {
    search.set("from", params.from);
  }
  if (params?.to) {
    search.set("to", params.to);
  }
  const queryString = search.size > 0 ? `?${search.toString()}` : "";
  const data = await apiClient.get<{ summary: CounterpartSummary }>(
    `/api/counterparts/${counterpartId}/summary${queryString}`,
    { responseSchema: SummaryResponseSchema },
  );
  return data.summary;
}

export async function updateCounterpart(id: number, payload: Partial<CounterpartUpsertPayload>) {
  return await apiClient.put<{ accounts: CounterpartAccount[]; counterpart: Counterpart }>(
    `/api/counterparts/${id}`,
    payload,
    { responseSchema: CounterpartResponseSchema },
  );
}

export async function updateCounterpartAccount(
  accountId: number,
  payload: Partial<{
    accountType: null | string;
    bankName: null | string;
  }>,
) {
  await apiClient.put(`/api/counterparts/accounts/${accountId}`, payload, {
    responseSchema: StatusResponseSchema,
  });
}
