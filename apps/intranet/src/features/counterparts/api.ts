import {
  assignRutToPayoutsResponseSchema,
  counterpartAccountsResponseSchema,
  counterpartDetailResponseSchema,
  counterpartStatusResponseSchema,
  counterpartSuggestionsResponseSchema,
  counterpartSummaryResponseSchema,
  counterpartsResponseSchema,
  counterpartsSyncResponseSchema,
  unassignedPayoutAccountsResponseSchema,
} from "@finanzas/orpc-contracts/counterparts";
import {
  type CounterpartUpsertPayload,
  counterpartsORPCClient,
  toCounterpartsApiError,
} from "./orpc";

export type { CounterpartUpsertPayload } from "./orpc";

export async function addCounterpartAccount(
  counterpartId: number,
  payload: {
    accountNumber: string;
    accountType?: null | string;
    bankName?: null | string;
  }
) {
  try {
    const data = counterpartAccountsResponseSchema.parse(
      await counterpartsORPCClient.addAccount({
        counterpartId,
        payload,
      })
    );
    return data.accounts;
  } catch (error) {
    throw toCounterpartsApiError(error);
  }
}

export async function attachCounterpartRut(counterpartId: number, rut: string) {
  try {
    const data = counterpartAccountsResponseSchema.parse(
      await counterpartsORPCClient.attachRut({ counterpartId, rut })
    );
    return data.accounts;
  } catch (error) {
    throw toCounterpartsApiError(error);
  }
}

export async function createCounterpart(payload: CounterpartUpsertPayload) {
  try {
    return counterpartDetailResponseSchema.parse(await counterpartsORPCClient.create(payload));
  } catch (error) {
    throw toCounterpartsApiError(error);
  }
}

export async function fetchAccountSuggestions(query: string, limit = 10) {
  try {
    const data = counterpartSuggestionsResponseSchema.parse(
      await counterpartsORPCClient.suggestions({
        limit,
        q: query,
      })
    );
    return data.suggestions;
  } catch (error) {
    throw toCounterpartsApiError(error);
  }
}

export async function fetchCounterpart(id: number) {
  try {
    return counterpartDetailResponseSchema.parse(await counterpartsORPCClient.detail({ id }));
  } catch (error) {
    throw toCounterpartsApiError(error);
  }
}

export async function fetchCounterparts() {
  try {
    const data = counterpartsResponseSchema.parse(await counterpartsORPCClient.list());
    return data.counterparts;
  } catch (error) {
    throw toCounterpartsApiError(error);
  }
}

export async function syncCounterparts() {
  try {
    return counterpartsSyncResponseSchema.parse(await counterpartsORPCClient.sync());
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
    return unassignedPayoutAccountsResponseSchema.parse(
      await counterpartsORPCClient.unassignedPayoutAccounts({
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 20,
        query: params?.query?.trim() || undefined,
      })
    );
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
    return assignRutToPayoutsResponseSchema.parse(
      await counterpartsORPCClient.assignRutToPayouts(payload)
    );
  } catch (error) {
    throw toCounterpartsApiError(error);
  }
}

export async function fetchCounterpartSummary(
  counterpartId: number,
  params?: { from?: string; to?: string }
) {
  try {
    const data = counterpartSummaryResponseSchema.parse(
      await counterpartsORPCClient.summary({
        from: params?.from,
        id: counterpartId,
        to: params?.to,
      })
    );
    return data.summary;
  } catch (error) {
    throw toCounterpartsApiError(error);
  }
}

export async function updateCounterpart(id: number, payload: Partial<CounterpartUpsertPayload>) {
  try {
    return counterpartDetailResponseSchema.parse(
      await counterpartsORPCClient.update({ id, payload })
    );
  } catch (error) {
    throw toCounterpartsApiError(error);
  }
}

export async function updateCounterpartAccount(
  accountId: number,
  payload: Partial<{
    accountType: null | string;
    bankName: null | string;
  }>
) {
  try {
    counterpartStatusResponseSchema.parse(
      await counterpartsORPCClient.updateAccount({ accountId, payload })
    );
  } catch (error) {
    throw toCounterpartsApiError(error);
  }
}
