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
  const withdrawals = await db.withdrawTransaction.findMany({
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
  });

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

  let conflictCount = 0;
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
      try {
        await upsertCounterpartAccount(counterpart.id, {
          accountNumber: account.accountNumber,
          accountType: account.accountType,
          bankName: account.bankName,
        });
        syncedAccounts += 1;
      } catch (error) {
        if (error instanceof CounterpartAccountConflictError) {
          conflictCount += 1;
          continue;
        }
        throw error;
      }
    }
  }

  return { conflictCount, syncedAccounts, syncedCounterparts };
}

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
        payoutBankAccountNumber: q
          ? {
              contains: q,
              mode: "insensitive",
            }
          : {
              not: null,
            },
      },
    }),
    db.withdrawTransaction.findMany({
      select: {
        bankAccountNumber: true,
        identificationNumber: true,
      },
      where: {
        bankAccountNumber: { not: null },
        identificationNumber: { not: null },
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
  const withdrawRutByAccount = new Map<string, string>();
  for (const row of withdrawRows) {
    const account = normalizeAccountNumber(row.bankAccountNumber ?? "");
    if (!account || !row.identificationNumber) {
      continue;
    }
    const rut = normalizeRut(row.identificationNumber);
    if (!rut) {
      continue;
    }
    withdrawRutByAccount.set(account, rut);
  }

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

    if (!conflict && (accountsWithRut.has(account) || linkedAccounts.has(account))) {
      continue;
    }

    const existing = grouped.get(account);
    if (existing) {
      existing.movementCount += 1;
      existing.totalGrossAmount += row.grossAmount ? Number(row.grossAmount) : 0;
      existing.conflict = existing.conflict || conflict;
      continue;
    }

    grouped.set(account, {
      conflict,
      counterpartId: linked?.counterpart?.id ?? null,
      counterpartName: linked?.counterpart?.bankAccountHolder ?? null,
      counterpartRut: linkedRut,
      movementCount: 1,
      payoutBankAccountNumber: account,
      totalGrossAmount: row.grossAmount ? Number(row.grossAmount) : 0,
      withdrawRut,
    });
  }

  const sorted = [...grouped.values()].toSorted((a, b) => {
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
