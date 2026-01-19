import { apiClient } from "@/lib/api-client";

import type {
  Counterpart,
  CounterpartAccount,
  CounterpartAccountSuggestion,
  CounterpartCategory,
  CounterpartPersonType,
  CounterpartSummary,
} from "./types";

export interface CounterpartUpsertPayload {
  category: CounterpartCategory;
  email?: null | string;
  employeeEmail?: null | string;
  name: string;
  notes?: null | string;
  personType: CounterpartPersonType;
  rut?: null | string;
}

export async function addCounterpartAccount(
  counterpartId: number,
  payload: {
    accountIdentifier: string;
    accountType?: null | string;
    bankName?: null | string;
    concept?: null | string;
    holder?: null | string;
    metadata?: null | {
      bankAccountNumber?: null | string;
      withdrawId?: null | string;
    };
  }
) {
  const data = await apiClient.post<{ accounts: CounterpartAccount[] }>(
    `/api/counterparts/${counterpartId}/accounts`,
    payload
  );
  return data.accounts;
}

export async function attachCounterpartRut(counterpartId: number, rut: string) {
  const data = await apiClient.post<{ accounts: CounterpartAccount[] }>(
    `/api/counterparts/${counterpartId}/attach-rut`,
    { rut }
  );
  return data.accounts;
}

export async function createCounterpart(payload: CounterpartUpsertPayload) {
  return await apiClient.post<{ accounts: CounterpartAccount[]; counterpart: Counterpart }>(
    "/api/counterparts",
    payload
  );
}

export async function fetchAccountSuggestions(query: string, limit = 10) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("limit", String(limit));
  const data = await apiClient.get<{ suggestions: CounterpartAccountSuggestion[] }>(
    `/api/counterparts/suggestions?${params.toString()}`
  );
  return data.suggestions;
}

export async function fetchCounterpart(id: number) {
  return await apiClient.get<{ accounts: CounterpartAccount[]; counterpart: Counterpart }>(`/api/counterparts/${id}`);
}

export async function fetchCounterparts() {
  const data = await apiClient.get<{ counterparts: Counterpart[] }>("/api/counterparts");
  return data.counterparts;
}

export async function fetchCounterpartSummary(counterpartId: number, params?: { from?: string; to?: string }) {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  const queryString = search.size > 0 ? `?${search.toString()}` : "";
  const data = await apiClient.get<{ summary: CounterpartSummary }>(
    `/api/counterparts/${counterpartId}/summary${queryString}`
  );
  return data.summary;
}

export async function updateCounterpart(id: number, payload: Partial<CounterpartUpsertPayload>) {
  return await apiClient.put<{ accounts: CounterpartAccount[]; counterpart: Counterpart }>(
    `/api/counterparts/${id}`,
    payload
  );
}

export async function updateCounterpartAccount(
  accountId: number,
  payload: Partial<{
    accountType: null | string;
    bankName: null | string;
    concept: null | string;
    holder: null | string;
  }>
) {
  await apiClient.put(`/api/counterparts/accounts/${accountId}`, payload);
}
