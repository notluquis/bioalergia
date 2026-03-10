import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type {
  Counterpart,
  CounterpartAccount,
  CounterpartAccountSuggestion,
  CounterpartCategory,
  CounterpartSummary,
  UnassignedPayoutAccount,
} from "./types";

type CounterpartUpsertPayload = {
  bankAccountHolder: string;
  category?: CounterpartCategory;
  identificationNumber: string;
  notes?: null | string;
};

type CounterpartsORPCClient = {
  addAccount: (input: {
    counterpartId: number;
    payload: {
      accountNumber: string;
      accountType?: null | string;
      bankName?: null | string;
    };
  }) => Promise<{ accounts: CounterpartAccount[] }>;
  assignRutToPayouts: (input: {
    accountNumbers: string[];
    bankAccountHolder?: string;
    rut: string;
  }) => Promise<{
    assignedCount: number;
    conflicts: UnassignedPayoutAccount[];
    counterpart: Counterpart;
  }>;
  attachRut: (input: { counterpartId: number; rut: string }) => Promise<{
    accounts: CounterpartAccount[];
  }>;
  create: (input: CounterpartUpsertPayload) => Promise<{
    accounts: CounterpartAccount[];
    counterpart: Counterpart;
  }>;
  detail: (input: { id: number }) => Promise<{
    accounts: CounterpartAccount[];
    counterpart: Counterpart;
  }>;
  list: () => Promise<{ counterparts: Counterpart[] }>;
  suggestions: (input: { limit?: number; q?: string }) => Promise<{
    suggestions: CounterpartAccountSuggestion[];
  }>;
  summary: (input: { from?: string; id: number; to?: string }) => Promise<{
    summary: CounterpartSummary;
  }>;
  sync: () => Promise<{
    conflictCount?: number;
    syncedAccounts: number;
    syncedCounterparts: number;
  }>;
  unassignedPayoutAccounts: (input?: {
    page?: number;
    pageSize?: number;
    query?: string;
  }) => Promise<{
    page: number;
    pageSize: number;
    rows: UnassignedPayoutAccount[];
    total: number;
  }>;
  update: (input: { id: number; payload: Partial<CounterpartUpsertPayload> }) => Promise<{
    accounts: CounterpartAccount[];
    counterpart: Counterpart;
  }>;
  updateAccount: (input: {
    accountId: number;
    payload: Partial<{
      accountType: null | string;
      bankName: null | string;
    }>;
  }) => Promise<{ status: "ok" }>;
};

const counterpartsORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const counterpartsORPCClient = createORPCClient<CounterpartsORPCClient>(
  counterpartsORPCLink,
  {
    path: ["api", "orpc", "counterparts", "rpc"],
  },
);

export function toCounterpartsApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof ORPCError) {
    return new ApiError(error.message, error.status, error.data);
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 500);
  }

  return new ApiError("Error inesperado", 500, error);
}

export type { CounterpartUpsertPayload };
