import { type CounterpartCategory, db } from "@finanzas/db";
import type { CounterpartAccountUpdateArgs } from "@finanzas/db/input";

type CounterpartAccountUpdateInput = NonNullable<CounterpartAccountUpdateArgs["data"]>;

export type CounterpartPayload = {
  category?: CounterpartCategory;
  identificationNumber: string;
  bankAccountHolder: string;
  notes?: string | null;
};

export type CounterpartUpdatePayload = Partial<CounterpartPayload>;

const normalizeRut = (rut: string): string => {
  return rut.replace(/[^0-9k]/gi, "").toUpperCase();
};

const normalizeAccountNumber = (accountNumber: string): string => {
  return accountNumber.trim();
};

export interface CounterpartAccountSuggestion {
  accountIdentifier: string;
  accountType: null | string;
  assignedCounterpartId: null | number;
  bankAccountNumber: null | string;
  bankName: null | string;
  identificationNumber: null | string;
  totalAmount: number;
  withdrawId: null | string;
}

const getValueFromJson = (value: unknown, key: string): null | string => {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = getValueFromJson(entry, key);
      if (found) {
        return found;
      }
    }
    return null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const raw = record[key];
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }
  return null;
};

const getFirstJsonValue = (value: unknown, keys: string[]): null | string => {
  for (const key of keys) {
    const found = getValueFromJson(value, key);
    if (found) {
      return found;
    }
  }
  return null;
};

type CounterpartAccumulator = {
  accountMap: Map<
    string,
    {
      accountNumber: string;
      accountType?: null | string;
      bankName?: null | string;
    }
  >;
  holder: string;
};

const ensureAccumulator = (
  map: Map<string, CounterpartAccumulator>,
  rut: string,
  holder: null | string | undefined,
) => {
  const existing = map.get(rut);
  if (existing) {
    if (!existing.holder && holder?.trim()) {
      existing.holder = holder.trim();
    }
    return existing;
  }

  const entry: CounterpartAccumulator = {
    accountMap: new Map(),
    holder: holder?.trim() || rut,
  };
  map.set(rut, entry);
  return entry;
};

const addAccountToAccumulator = (
  accumulator: CounterpartAccumulator,
  accountNumber: null | string | undefined,
  accountType: null | string | undefined,
  bankName: null | string | undefined,
) => {
  const normalizedAccount = accountNumber ? normalizeAccountNumber(accountNumber) : "";
  if (!normalizedAccount || accumulator.accountMap.has(normalizedAccount)) {
    return;
  }

  accumulator.accountMap.set(normalizedAccount, {
    accountNumber: normalizedAccount,
    accountType: accountType ?? null,
    bankName: bankName ?? null,
  });
};

export async function syncCounterpartsFromTransactions() {
  const [withdrawals, releaseRows, settlementRows] = await Promise.all([
    db.withdrawTransaction.findMany({
      orderBy: { dateCreated: "desc" },
      select: {
        bankAccountHolder: true,
        bankAccountNumber: true,
        bankAccountType: true,
        bankName: true,
        identificationNumber: true,
      },
      where: {
        identificationNumber: {
          not: null,
        },
      },
    }),
    db.releaseTransaction.findMany({
      orderBy: { date: "desc" },
      select: {
        identificationNumber: true,
        metadata: true,
        payoutBankAccountNumber: true,
      },
      where: {
        identificationNumber: {
          not: null,
        },
      },
    }),
    db.settlementTransaction.findMany({
      orderBy: { transactionDate: "desc" },
      select: {
        identificationNumber: true,
        metadata: true,
      },
      where: {
        identificationNumber: {
          not: null,
        },
      },
    }),
  ]);

  const byRut = new Map<string, CounterpartAccumulator>();

  for (const row of withdrawals) {
    if (!row.identificationNumber) {
      continue;
    }
    const rut = normalizeRut(row.identificationNumber);
    if (!rut) {
      continue;
    }

    const accumulator = ensureAccumulator(byRut, rut, row.bankAccountHolder);
    addAccountToAccumulator(
      accumulator,
      row.bankAccountNumber,
      row.bankAccountType ?? null,
      row.bankName ?? null,
    );
  }

  for (const row of releaseRows) {
    if (!row.identificationNumber) {
      continue;
    }
    const rut = normalizeRut(row.identificationNumber);
    if (!rut) {
      continue;
    }

    const accumulator = ensureAccumulator(
      byRut,
      rut,
      getFirstJsonValue(row.metadata, [
        "bank_account_holder_name",
        "bank_account_holder",
        "holder",
        "name",
      ]),
    );
    addAccountToAccumulator(
      accumulator,
      row.payoutBankAccountNumber ??
        getFirstJsonValue(row.metadata, [
          "bank_account_number",
          "account_number",
          "payout_bank_account_number",
          "bankAccountNumber",
          "accountNumber",
        ]),
      getFirstJsonValue(row.metadata, ["bank_account_type", "account_type"]),
      getFirstJsonValue(row.metadata, ["bank_name", "bank"]),
    );
  }

  for (const row of settlementRows) {
    if (!row.identificationNumber) {
      continue;
    }
    const rut = normalizeRut(row.identificationNumber);
    if (!rut) {
      continue;
    }

    const accumulator = ensureAccumulator(
      byRut,
      rut,
      getFirstJsonValue(row.metadata, [
        "bank_account_holder_name",
        "bank_account_holder",
        "holder",
        "name",
      ]),
    );
    addAccountToAccumulator(
      accumulator,
      getFirstJsonValue(row.metadata, [
        "bank_account_number",
        "account_number",
        "bankAccountNumber",
        "accountNumber",
      ]),
      getFirstJsonValue(row.metadata, ["bank_account_type", "account_type"]),
      getFirstJsonValue(row.metadata, ["bank_name", "bank"]),
    );
  }

  let syncedCounterparts = 0;
  let syncedAccounts = 0;

  for (const [rut, counterpartData] of byRut.entries()) {
    const counterpart = await db.counterpart.upsert({
      create: {
        bankAccountHolder: counterpartData.holder || rut,
        category: "SUPPLIER",
        identificationNumber: rut,
      },
      update: {},
      where: { identificationNumber: rut },
    });
    syncedCounterparts += 1;

    for (const account of counterpartData.accountMap.values()) {
      await upsertCounterpartAccount(counterpart.id, {
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        bankName: account.bankName,
      });
      syncedAccounts += 1;
    }
  }

  return { syncedAccounts, syncedCounterparts };
}

export async function getCounterpartSuggestions(query: string, limit: number) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [] as CounterpartAccountSuggestion[];
  }

  const rows = await db.withdrawTransaction.findMany({
    orderBy: { dateCreated: "desc" },
    select: {
      amount: true,
      bankAccountNumber: true,
      bankAccountType: true,
      bankName: true,
      identificationNumber: true,
      withdrawId: true,
    },
    take: Math.max(limit * 10, 100),
    where: {
      OR: [
        { bankAccountHolder: { contains: trimmedQuery, mode: "insensitive" } },
        { bankAccountNumber: { contains: trimmedQuery, mode: "insensitive" } },
        { identificationNumber: { contains: trimmedQuery, mode: "insensitive" } },
      ],
    },
  });

  const grouped = new Map<string, CounterpartAccountSuggestion>();
  for (const row of rows) {
    const accountIdentifier = row.bankAccountNumber?.trim() || row.withdrawId?.trim() || "";
    if (!accountIdentifier) {
      continue;
    }
    const existing = grouped.get(accountIdentifier);
    if (existing) {
      existing.totalAmount += row.amount ? Number(row.amount) : 0;
      continue;
    }

    grouped.set(accountIdentifier, {
      accountIdentifier,
      accountType: row.bankAccountType ?? null,
      assignedCounterpartId: null,
      bankAccountNumber: row.bankAccountNumber ?? null,
      bankName: row.bankName ?? null,
      identificationNumber: row.identificationNumber
        ? normalizeRut(row.identificationNumber)
        : null,
      totalAmount: row.amount ? Number(row.amount) : 0,
      withdrawId: row.withdrawId ?? null,
    });
  }

  const identifiers = [...grouped.keys()];
  if (identifiers.length > 0) {
    const linkedAccounts = await db.counterpartAccount.findMany({
      select: { accountNumber: true, counterpartId: true },
      where: { accountNumber: { in: identifiers } },
    });
    const linkedMap = new Map(linkedAccounts.map((row) => [row.accountNumber, row.counterpartId]));

    for (const suggestion of grouped.values()) {
      suggestion.assignedCounterpartId = linkedMap.get(suggestion.accountIdentifier) ?? null;
    }
  }

  return [...grouped.values()]
    .toSorted((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, Math.max(limit, 1));
}

export async function listCounterparts() {
  await syncCounterpartsFromTransactions();
  return await db.counterpart.findMany({
    orderBy: { bankAccountHolder: "asc" },
    include: {
      accounts: true,
      withdrawTransactions: true,
      releaseTransactions: true,
      settlementTransactions: true,
    },
  });
}

export async function getCounterpartById(id: number) {
  const counterpart = await db.counterpart.findUnique({
    where: { id },
    include: {
      accounts: true,
      withdrawTransactions: true,
      releaseTransactions: true,
      settlementTransactions: true,
    },
  });

  if (!counterpart) {
    throw new Error(`Counterpart with ID ${id} not found`);
  }

  return {
    counterpart,
    accounts: counterpart.accounts,
  };
}

export async function getCounterpartByRut(identificationNumber: string) {
  const counterpart = await db.counterpart.findUnique({
    where: { identificationNumber },
    include: {
      accounts: true,
      withdrawTransactions: true,
      releaseTransactions: true,
      settlementTransactions: true,
    },
  });

  if (!counterpart) {
    throw new Error(`Counterpart with RUT ${identificationNumber} not found`);
  }

  return {
    counterpart,
    accounts: counterpart.accounts,
  };
}

export async function createCounterpart(data: CounterpartPayload) {
  const rut = normalizeRut(data.identificationNumber);

  // Check if exists by RUT
  const existing = await db.counterpart.findUnique({
    where: { identificationNumber: rut },
  });

  if (existing) {
    throw new Error(`Counterpart with RUT ${rut} already exists`);
  }

  return await db.counterpart.create({
    data: {
      identificationNumber: rut,
      bankAccountHolder: data.bankAccountHolder,
      category: data.category || "SUPPLIER",
      notes: data.notes,
    },
    include: { accounts: true },
  });
}

export async function updateCounterpart(id: number, data: CounterpartUpdatePayload) {
  const counterpart = await db.counterpart.findUnique({ where: { id } });
  if (!counterpart) {
    throw new Error("Counterpart not found");
  }

  const updateData: Partial<CounterpartPayload> = {};
  if (data.identificationNumber !== undefined) {
    updateData.identificationNumber = normalizeRut(data.identificationNumber);
  }
  if (data.bankAccountHolder !== undefined) {
    updateData.bankAccountHolder = data.bankAccountHolder;
  }
  if (data.category !== undefined) {
    updateData.category = data.category;
  }
  if (data.notes !== undefined) {
    updateData.notes = data.notes;
  }

  return await db.counterpart.update({
    where: { id },
    data: updateData,
    include: { accounts: true },
  });
}

export async function upsertCounterpartAccount(
  counterpartId: number,
  payload: {
    accountNumber: string;
    bankName?: string | null;
    accountType?: string | null;
  },
) {
  const normalizedAccount = normalizeAccountNumber(payload.accountNumber);
  const existing = await db.counterpartAccount.findFirst({
    where: {
      counterpartId,
      accountNumber: normalizedAccount,
    },
  });

  if (existing) {
    return await db.counterpartAccount.update({
      where: { id: existing.id },
      data: {
        bankName: payload.bankName === undefined ? undefined : payload.bankName,
        accountType: payload.accountType === undefined ? undefined : payload.accountType,
      },
    });
  } else {
    return await db.counterpartAccount.create({
      data: {
        counterpartId,
        accountNumber: normalizedAccount,
        bankName: payload.bankName,
        accountType: payload.accountType,
      },
    });
  }
}

export async function updateCounterpartAccount(
  accountId: number,
  payload: CounterpartAccountUpdateInput,
) {
  return await db.counterpartAccount.update({
    where: { id: accountId },
    data: payload,
  });
}

export async function attachRutToCounterpart(counterpartId: number, rutInput: string) {
  const rut = normalizeRut(rutInput);
  if (!rut) {
    throw new Error("RUT inválido");
  }

  const counterpart = await db.counterpart.findUnique({
    where: { id: counterpartId },
  });
  if (!counterpart) {
    throw new Error("Counterpart not found");
  }

  const existingByRut = await db.counterpart.findUnique({
    where: { identificationNumber: rut },
  });

  if (existingByRut && existingByRut.id !== counterpartId) {
    throw new Error(`El RUT ${rut} ya está vinculado a otra contraparte (ID ${existingByRut.id})`);
  }

  if (counterpart.identificationNumber !== rut) {
    await db.counterpart.update({
      where: { id: counterpartId },
      data: { identificationNumber: rut },
    });
  }

  const rows = await db.withdrawTransaction.findMany({
    select: {
      bankAccountNumber: true,
      bankAccountType: true,
      bankName: true,
    },
    where: {
      identificationNumber: rut,
    },
  });

  for (const row of rows) {
    if (!row.bankAccountNumber?.trim()) {
      continue;
    }
    await upsertCounterpartAccount(counterpartId, {
      accountNumber: row.bankAccountNumber,
      accountType: row.bankAccountType ?? null,
      bankName: row.bankName ?? null,
    });
  }

  const detail = await getCounterpartById(counterpartId);
  return detail.accounts;
}
