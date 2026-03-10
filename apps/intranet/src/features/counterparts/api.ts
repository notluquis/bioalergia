import { z } from "zod";
import {
  type CounterpartUpsertPayload,
  counterpartsORPCClient,
  toCounterpartsApiError,
} from "./orpc";
import type {
  Counterpart,
  CounterpartAccount,
  CounterpartAccountSuggestion,
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

const StatusResponseSchema = z.object({ status: z.literal("ok") });

export async function addCounterpartAccount(
  counterpartId: number,
  payload: {
    accountNumber: string;
    accountType?: null | string;
    bankName?: null | string;
  },
) {
  try {
    const data = AccountsResponseSchema.parse(
      await counterpartsORPCClient.addAccount({
        counterpartId,
        payload,
      }),
    );
    return data.accounts as CounterpartAccount[];
  } catch (error) {
    throw toCounterpartsApiError(error);
  }
}

export async function attachCounterpartRut(counterpartId: number, rut: string) {
  try {
    const data = AccountsResponseSchema.parse(
      await counterpartsORPCClient.attachRut({ counterpartId, rut }),
    );
    return data.accounts as CounterpartAccount[];
  } catch (error) {
    throw toCounterpartsApiError(error);
  }
}

export async function createCounterpart(payload: CounterpartUpsertPayload) {
  try {
    return CounterpartResponseSchema.parse(await counterpartsORPCClient.create(payload)) as {
      accounts: CounterpartAccount[];
      counterpart: Counterpart;
    };
  } catch (error) {
    throw toCounterpartsApiError(error);
  }
}

export async function fetchAccountSuggestions(query: string, limit = 10) {
  try {
    const data = SuggestionsResponseSchema.parse(
      await counterpartsORPCClient.suggestions({
        limit,
        q: query,
      }),
    );
    return data.suggestions as CounterpartAccountSuggestion[];
  } catch (error) {
    throw toCounterpartsApiError(error);
  }
}

export async function fetchCounterpart(id: number) {
  try {
    return CounterpartResponseSchema.parse(await counterpartsORPCClient.detail({ id })) as {
      accounts: CounterpartAccount[];
      counterpart: Counterpart;
    };
  } catch (error) {
    throw toCounterpartsApiError(error);
  }
}

export async function fetchCounterparts() {
  try {
    const data = CounterpartsResponseSchema.parse(await counterpartsORPCClient.list());
    return data.counterparts as Counterpart[];
  } catch (error) {
    throw toCounterpartsApiError(error);
  }
}

export async function syncCounterparts() {
  try {
    return CounterpartsSyncResponseSchema.parse(await counterpartsORPCClient.sync());
  } catch (error) {
    throw toCounterpartsApiError(error);
  }
}

export async function fetchUnassignedPayoutAccounts(params?: {
  page?: number;
  pageSize?: number;
  query?: string;
}) {
  try {
    return UnassignedPayoutAccountsResponseSchema.parse(
      await counterpartsORPCClient.unassignedPayoutAccounts({
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 20,
        query: params?.query?.trim() || undefined,
      }),
    ) as {
      page: number;
      pageSize: number;
      rows: UnassignedPayoutAccount[];
      total: number;
    };
  } catch (error) {
    throw toCounterpartsApiError(error);
  }
}

export async function assignRutToPayouts(payload: {
  accountNumbers: string[];
  bankAccountHolder?: string;
  rut: string;
}) {
  try {
    return AssignRutToPayoutsResponseSchema.parse(
      await counterpartsORPCClient.assignRutToPayouts(payload),
    ) as {
      assignedCount: number;
      conflicts: UnassignedPayoutAccount[];
      counterpart: Counterpart;
    };
  } catch (error) {
    throw toCounterpartsApiError(error);
  }
}

export async function fetchCounterpartSummary(
  counterpartId: number,
  params?: { from?: string; to?: string },
) {
  try {
    const data = SummaryResponseSchema.parse(
      await counterpartsORPCClient.summary({
        from: params?.from,
        id: counterpartId,
        to: params?.to,
      }),
    );
    return data.summary as CounterpartSummary;
  } catch (error) {
    throw toCounterpartsApiError(error);
  }
}

export async function updateCounterpart(id: number, payload: Partial<CounterpartUpsertPayload>) {
  try {
    return CounterpartResponseSchema.parse(
      await counterpartsORPCClient.update({ id, payload }),
    ) as {
      accounts: CounterpartAccount[];
      counterpart: Counterpart;
    };
  } catch (error) {
    throw toCounterpartsApiError(error);
  }
}

export async function updateCounterpartAccount(
  accountId: number,
  payload: Partial<{
    accountType: null | string;
    bankName: null | string;
  }>,
) {
  try {
    await StatusResponseSchema.parse(
      await counterpartsORPCClient.updateAccount({ accountId, payload }),
    );
  } catch (error) {
    throw toCounterpartsApiError(error);
  }
}
