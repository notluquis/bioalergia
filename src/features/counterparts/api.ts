import { apiClient } from "../../lib/apiClient";
import type {
  Counterpart,
  CounterpartAccount,
  CounterpartAccountSuggestion,
  CounterpartSummary,
  CounterpartPersonType,
  CounterpartCategory,
} from "./types";

export async function fetchCounterparts() {
  const data = await apiClient.get<{ counterparts: Counterpart[] }>("/api/counterparts");
  return data.counterparts;
}

export async function fetchCounterpart(id: number) {
  return await apiClient.get<{ counterpart: Counterpart; accounts: CounterpartAccount[] }>(`/api/counterparts/${id}`);
}

export async function createCounterpart(payload: {
  rut?: string | null;
  name: string;
  personType: CounterpartPersonType;
  category: CounterpartCategory;
  email?: string | null;
  employeeEmail?: string | null;
  notes?: string | null;
}) {
  return await apiClient.post<{ counterpart: Counterpart; accounts: CounterpartAccount[] }>(
    "/api/counterparts",
    payload
  );
}

export async function updateCounterpart(
  id: number,
  payload: Partial<{
    rut: string | null;
    name: string;
    personType: CounterpartPersonType;
    category: CounterpartCategory;
    email: string | null;
    employeeEmail: string | null;
    notes: string | null;
  }>
) {
  return await apiClient.put<{ counterpart: Counterpart; accounts: CounterpartAccount[] }>(
    `/api/counterparts/${id}`,
    payload
  );
}

export async function addCounterpartAccount(
  counterpartId: number,
  payload: {
    accountIdentifier: string;
    bankName?: string | null;
    accountType?: string | null;
    holder?: string | null;
    concept?: string | null;
    metadata?: {
      bankAccountNumber?: string | null;
      withdrawId?: string | null;
    } | null;
  }
) {
  const data = await apiClient.post<{ accounts: CounterpartAccount[] }>(
    `/api/counterparts/${counterpartId}/accounts`,
    payload
  );
  return data.accounts;
}

export async function updateCounterpartAccount(
  accountId: number,
  payload: Partial<{
    bankName: string | null;
    accountType: string | null;
    holder: string | null;
    concept: string | null;
  }>
) {
  await apiClient.put(`/api/counterparts/accounts/${accountId}`, payload);
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

export async function fetchCounterpartSummary(counterpartId: number, params?: { from?: string; to?: string }) {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  const data = await apiClient.get<{ summary: CounterpartSummary }>(
    `/api/counterparts/${counterpartId}/summary${search.size ? `?${search.toString()}` : ""}`
  );
  return data.summary;
}

export async function attachCounterpartRut(counterpartId: number, rut: string) {
  const data = await apiClient.post<{ accounts: CounterpartAccount[] }>(
    `/api/counterparts/${counterpartId}/attach-rut`,
    { rut }
  );
  return data.accounts;
}
