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

const NON_RUT_CHARS_REGEX = /[^0-9k]/gi;
const NON_ACCOUNT_CHARS_REGEX = /[^0-9a-z]/gi;
const LEADING_ZEROS_REGEX = /^0+/;

const normalizeRut = (rut: string): string => {
  return rut.replace(NON_RUT_CHARS_REGEX, "").toUpperCase();
};

const normalizeAccountNumber = (accountNumber: string): string => {
  const compact = accountNumber.replace(NON_ACCOUNT_CHARS_REGEX, "").toUpperCase();
  if (!compact) {
    return "";
  }
  const normalized = compact.replace(LEADING_ZEROS_REGEX, "");
  return normalized.length > 0 ? normalized : "0";
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

export interface UnassignedPayoutAccount {
  conflict: boolean;
  counterpartId: null | number;
  counterpartName: null | string;
  counterpartRut: null | string;
  movementCount: number;
  payoutBankAccountNumber: string;
  totalGrossAmount: number;
  withdrawRut: null | string;
}

export class CounterpartAccountConflictError extends Error {
  readonly accountNumber: string;
  readonly counterpartId: number;
  readonly counterpartRut: string;
  readonly withdrawRut: string;

  constructor(params: {
    accountNumber: string;
    counterpartId: number;
    counterpartRut: string;
    withdrawRut: string;
  }) {
    super(
      `Conflicto en cuenta ${params.accountNumber}: linked ${params.counterpartRut}, withdraw ${params.withdrawRut}`,
    );
    this.accountNumber = params.accountNumber;
    this.counterpartId = params.counterpartId;
    this.counterpartRut = params.counterpartRut;
    this.withdrawRut = params.withdrawRut;
  }
}

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

type CounterpartSyncCounters = {
  conflictCount: number;
  syncedAccounts: number;
  syncedCounterparts: number;
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

const toNumericAmount = (amount: unknown): number => {
  return amount ? Number(amount) : 0;
};

const buildCounterpartAccumulatorMap = (
  withdrawals: Array<{
    bankAccountHolder: null | string;
    bankAccountNumber: null | string;
    bankAccountType: null | string;
    bankName: null | string;
    identificationNumber: null | string;
  }>,
) => {
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

  return byRut;
};

const upsertCounterpartFromAccumulator = async (rut: string, data: CounterpartAccumulator) => {
  return await db.counterpart.upsert({
    create: {
      bankAccountHolder: data.holder || rut,
      category: "SUPPLIER",
      identificationNumber: rut,
    },
    update: {},
    where: { identificationNumber: rut },
  });
};

const syncAccountsForCounterpart = async (
  counterpartId: number,
  accounts: CounterpartAccumulator["accountMap"],
) => {
  const counters = { conflictCount: 0, syncedAccounts: 0 };
  for (const account of accounts.values()) {
    try {
      await upsertCounterpartAccount(counterpartId, {
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        bankName: account.bankName,
      });
      counters.syncedAccounts += 1;
    } catch (error) {
      if (error instanceof CounterpartAccountConflictError) {
        counters.conflictCount += 1;
        continue;
      }
      throw error;
    }
  }
  return counters;
};

export async function syncCounterpartsFromTransactions() {
  const withdrawals = await db.withdrawTransaction.findMany({
    orderBy: { dateCreated: "desc" },
    select: {
      bankAccountHolder: true,
      bankAccountNumber: true,
      bankAccountType: true,
      bankName: true,
      identificationNumber: true,
    },
  });

  const byRut = buildCounterpartAccumulatorMap(withdrawals);
  const counters: CounterpartSyncCounters = {
    conflictCount: 0,
    syncedAccounts: 0,
    syncedCounterparts: 0,
  };

  for (const [rut, counterpartData] of byRut.entries()) {
    const counterpart = await upsertCounterpartFromAccumulator(rut, counterpartData);
    counters.syncedCounterparts += 1;
    const accountCounters = await syncAccountsForCounterpart(
      counterpart.id,
      counterpartData.accountMap,
    );
    counters.conflictCount += accountCounters.conflictCount;
    counters.syncedAccounts += accountCounters.syncedAccounts;
  }

  return counters;
}

const buildPayoutBankAccountWhere = (query: string) => {
  if (!query) {
    return undefined;
  }

  return {
    contains: query,
    mode: "insensitive" as const,
  };
};

const buildWithdrawRutByAccount = (
  withdrawRows: Array<{ bankAccountNumber: null | string; identificationNumber: null | string }>,
) => {
  const map = new Map<string, string>();
  for (const row of withdrawRows) {
    const account = normalizeAccountNumber(row.bankAccountNumber ?? "");
    if (!account || !row.identificationNumber) {
      continue;
    }
    const rut = normalizeRut(row.identificationNumber);
    if (!rut) {
      continue;
    }
    map.set(account, rut);
  }
  return map;
};

const shouldSkipPayoutAccount = (
  account: string,
  conflict: boolean,
  accountsWithRut: Set<string>,
  linkedAccounts: Set<string>,
) => {
  if (conflict) {
    return false;
  }

  return accountsWithRut.has(account) || linkedAccounts.has(account);
};

const updateOrCreateUnassignedPayoutEntry = (
  grouped: Map<string, UnassignedPayoutAccount>,
  params: {
    account: string;
    conflict: boolean;
    grossAmount: unknown;
    linked:
      | {
          counterpart?: {
            bankAccountHolder: string;
            id: number;
            identificationNumber: string;
          } | null;
        }
      | undefined;
    linkedRut: null | string;
    withdrawRut: null | string;
  },
) => {
  const existing = grouped.get(params.account);
  const amount = toNumericAmount(params.grossAmount);

  if (existing) {
    existing.movementCount += 1;
    existing.totalGrossAmount += amount;
    existing.conflict = existing.conflict || params.conflict;
    return;
  }

  grouped.set(params.account, {
    conflict: params.conflict,
    counterpartId: params.linked?.counterpart?.id ?? null,
    counterpartName: params.linked?.counterpart?.bankAccountHolder ?? null,
    counterpartRut: params.linkedRut,
    movementCount: 1,
    payoutBankAccountNumber: params.account,
    totalGrossAmount: amount,
    withdrawRut: params.withdrawRut,
  });
};

const sortUnassignedPayoutAccounts = (rows: UnassignedPayoutAccount[]) => {
  return rows.toSorted((a, b) => {
    if (a.conflict !== b.conflict) {
      return Number(b.conflict) - Number(a.conflict);
    }
    if (b.movementCount !== a.movementCount) {
      return b.movementCount - a.movementCount;
    }
    return a.payoutBankAccountNumber.localeCompare(b.payoutBankAccountNumber, "es", {
      sensitivity: "base",
    });
  });
};

export async function listUnassignedPayoutAccounts(params: {
  page: number;
  pageSize: number;
  query?: string;
}) {
  const q = params.query?.trim() ?? "";

  const [releaseRows, withdrawRows, linkedRows] = await Promise.all([
    db.releaseTransaction.findMany({
      select: {
        grossAmount: true,
        payoutBankAccountNumber: true,
      },
      where: {
        payoutBankAccountNumber: buildPayoutBankAccountWhere(q),
      },
    }),
    db.withdrawTransaction.findMany({
      select: {
        bankAccountNumber: true,
        identificationNumber: true,
      },
    }),
    db.counterpartAccount.findMany({
      include: {
        counterpart: {
          select: {
            bankAccountHolder: true,
            id: true,
            identificationNumber: true,
          },
        },
      },
    }),
  ]);

  const accountsWithRut = new Set(
    withdrawRows
      .map((row) => normalizeAccountNumber(row.bankAccountNumber ?? ""))
      .filter((value) => value.length > 0),
  );
  const linkedAccounts = new Set(
    linkedRows
      .map((row) => normalizeAccountNumber(row.accountNumber))
      .filter((value) => value.length > 0),
  );

  const linkedByAccount = new Map(
    linkedRows.map((row) => [normalizeAccountNumber(row.accountNumber), row]),
  );
  const withdrawRutByAccount = buildWithdrawRutByAccount(withdrawRows);

  const grouped = new Map<string, UnassignedPayoutAccount>();
  for (const row of releaseRows) {
    const account = normalizeAccountNumber(row.payoutBankAccountNumber ?? "");
    if (!account) {
      continue;
    }
    const linked = linkedByAccount.get(account);
    const withdrawRut = withdrawRutByAccount.get(account) ?? null;
    const linkedRut = linked?.counterpart?.identificationNumber ?? null;
    const conflict = Boolean(linked && withdrawRut && linkedRut && linkedRut !== withdrawRut);

    if (shouldSkipPayoutAccount(account, conflict, accountsWithRut, linkedAccounts)) {
      continue;
    }

    updateOrCreateUnassignedPayoutEntry(grouped, {
      account,
      conflict,
      grossAmount: row.grossAmount,
      linked,
      linkedRut,
      withdrawRut,
    });
  }

  const sorted = sortUnassignedPayoutAccounts([...grouped.values()]);
  const total = sorted.length;
  const safePageSize = Math.max(params.pageSize, 1);
  const safePage = Math.max(params.page, 1);
  const start = (safePage - 1) * safePageSize;
  const rows = sorted.slice(start, start + safePageSize);

  return {
    page: safePage,
    pageSize: safePageSize,
    rows,
    total,
  };
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

  const grouped = buildCounterpartSuggestions(rows);
  await attachCounterpartAssignments(grouped);

  return [...grouped.values()]
    .toSorted((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, Math.max(limit, 1));
}

const buildCounterpartSuggestions = (
  rows: Array<{
    amount: unknown;
    bankAccountNumber: null | string;
    bankAccountType: null | string;
    bankName: null | string;
    identificationNumber: null | string;
    withdrawId: null | string;
  }>,
) => {
  const grouped = new Map<string, CounterpartAccountSuggestion>();
  for (const row of rows) {
    const accountIdentifier = normalizeAccountNumber(row.bankAccountNumber ?? row.withdrawId ?? "");
    if (!accountIdentifier) {
      continue;
    }
    const existing = grouped.get(accountIdentifier);
    if (existing) {
      existing.totalAmount += toNumericAmount(row.amount);
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
      totalAmount: toNumericAmount(row.amount),
      withdrawId: row.withdrawId ?? null,
    });
  }
  return grouped;
};

const attachCounterpartAssignments = async (grouped: Map<string, CounterpartAccountSuggestion>) => {
  const identifiers = [...grouped.keys()];
  if (identifiers.length === 0) {
    return;
  }

  const linkedAccounts = await db.counterpartAccount.findMany({
    select: { accountNumber: true, counterpartId: true },
    where: { accountNumber: { in: identifiers } },
  });
  const linkedMap = new Map(linkedAccounts.map((row) => [row.accountNumber, row.counterpartId]));

  for (const suggestion of grouped.values()) {
    suggestion.assignedCounterpartId = linkedMap.get(suggestion.accountIdentifier) ?? null;
  }
};

export async function listCounterparts() {
  return await db.counterpart.findMany({
    orderBy: { bankAccountHolder: "asc" },
    include: {
      accounts: {
        select: {
          accountNumber: true,
          accountType: true,
          bankName: true,
          counterpartId: true,
          id: true,
        },
      },
    },
  });
}

export async function getCounterpartById(id: number) {
  const counterpart = await db.counterpart.findUnique({
    where: { id },
    include: {
      accounts: {
        select: {
          accountNumber: true,
          accountType: true,
          bankName: true,
          counterpartId: true,
          id: true,
        },
      },
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
      accounts: {
        select: {
          accountNumber: true,
          accountType: true,
          bankName: true,
          counterpartId: true,
          id: true,
        },
      },
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
  const existingAny = await db.counterpartAccount.findFirst({
    include: {
      counterpart: {
        select: {
          id: true,
          identificationNumber: true,
        },
      },
    },
    where: {
      accountNumber: normalizedAccount,
    },
  });
  if (existingAny && existingAny.counterpartId !== counterpartId) {
    const targetCounterpart = await db.counterpart.findUnique({
      where: { id: counterpartId },
      select: { identificationNumber: true },
    });
    throw new CounterpartAccountConflictError({
      accountNumber: normalizedAccount,
      counterpartId: existingAny.counterpartId,
      counterpartRut: existingAny.counterpart.identificationNumber,
      withdrawRut: targetCounterpart?.identificationNumber ?? "UNKNOWN",
    });
  }

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
  const existingAccount = await db.counterpartAccount.findUnique({
    where: { id: accountId },
    select: { counterpartId: true, id: true },
  });
  if (!existingAccount) {
    throw new Error("Counterpart account not found");
  }

  const updateData: CounterpartAccountUpdateInput = { ...payload };
  if (payload.accountNumber !== undefined) {
    const normalizedAccount = normalizeAccountNumber(payload.accountNumber);
    if (!normalizedAccount) {
      throw new Error("Número de cuenta inválido");
    }

    const conflicting = await db.counterpartAccount.findFirst({
      include: {
        counterpart: {
          select: {
            identificationNumber: true,
          },
        },
      },
      where: {
        accountNumber: normalizedAccount,
        id: { not: accountId },
      },
    });

    if (conflicting && conflicting.counterpartId !== existingAccount.counterpartId) {
      const targetCounterpart = await db.counterpart.findUnique({
        where: { id: existingAccount.counterpartId },
        select: { identificationNumber: true },
      });
      throw new CounterpartAccountConflictError({
        accountNumber: normalizedAccount,
        counterpartId: conflicting.counterpartId,
        counterpartRut: conflicting.counterpart.identificationNumber,
        withdrawRut: targetCounterpart?.identificationNumber ?? "UNKNOWN",
      });
    }

    updateData.accountNumber = normalizedAccount;
  }

  return await db.counterpartAccount.update({
    where: { id: accountId },
    data: updateData,
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

export async function assignRutToPayoutAccounts(params: {
  accountNumbers: string[];
  bankAccountHolder?: string;
  rut: string;
}) {
  const rut = normalizeRut(params.rut);
  if (!rut) {
    throw new Error("RUT inválido");
  }
  const uniqueAccounts = [
    ...new Set(params.accountNumbers.map(normalizeAccountNumber).filter(Boolean)),
  ];
  if (uniqueAccounts.length === 0) {
    return { assignedCount: 0, conflicts: [] as UnassignedPayoutAccount[] };
  }

  const counterpart = await db.counterpart.upsert({
    create: {
      bankAccountHolder: params.bankAccountHolder?.trim() || `Titular ${rut}`,
      category: "SUPPLIER",
      identificationNumber: rut,
    },
    update: {
      bankAccountHolder: params.bankAccountHolder?.trim() || undefined,
    },
    where: { identificationNumber: rut },
  });

  const conflicts: UnassignedPayoutAccount[] = [];
  let assignedCount = 0;
  for (const accountNumber of uniqueAccounts) {
    try {
      await upsertCounterpartAccount(counterpart.id, { accountNumber });
      assignedCount += 1;
    } catch (error) {
      if (!(error instanceof CounterpartAccountConflictError)) {
        throw error;
      }
      const linked = await db.counterpart.findUnique({
        where: { id: error.counterpartId },
        select: { bankAccountHolder: true, id: true, identificationNumber: true },
      });
      conflicts.push({
        conflict: true,
        counterpartId: linked?.id ?? null,
        counterpartName: linked?.bankAccountHolder ?? null,
        counterpartRut: linked?.identificationNumber ?? error.counterpartRut,
        movementCount: 0,
        payoutBankAccountNumber: accountNumber,
        totalGrossAmount: 0,
        withdrawRut: rut,
      });
    }
  }

  return { assignedCount, conflicts, counterpart };
}

export async function getCounterpartSummary(counterpartId: number) {
  const counterpart = await db.counterpart.findUnique({
    select: { identificationNumber: true },
    where: { id: counterpartId },
  });

  if (!counterpart) {
    throw new Error(`Counterpart with ID ${counterpartId} not found`);
  }

  const identificationNumber = counterpart.identificationNumber;

  const [withdrawGrouped, releaseGrouped, settlementCount] = await Promise.all([
    db.withdrawTransaction.groupBy({
      by: ["identificationNumber"],
      where: {
        identificationNumber,
      },
      _sum: {
        amount: true,
      },
    }),
    db.releaseTransaction.groupBy({
      by: ["identificationNumber"],
      where: {
        identificationNumber,
      },
      _sum: {
        grossAmount: true,
      },
    }),
    db.settlementTransaction.count({
      where: {
        identificationNumber,
      },
    }),
  ]);

  const withdrawTotal = Number(withdrawGrouped[0]?._sum.amount ?? 0);
  const releaseTotal = Number(releaseGrouped[0]?._sum.grossAmount ?? 0);

  return {
    releaseTotal,
    settlementCount,
    withdrawTotal,
  };
}
