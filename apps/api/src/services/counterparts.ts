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
  return rut.trim();
};

export async function listCounterparts() {
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
  const existing = await db.counterpartAccount.findFirst({
    where: {
      counterpartId,
      accountNumber: payload.accountNumber,
    },
  });

  if (existing) {
    return await db.counterpartAccount.update({
      where: { id: existing.id },
      data: {
        bankName: payload.bankName,
        accountType: payload.accountType,
      },
    });
  } else {
    return await db.counterpartAccount.create({
      data: {
        counterpartId,
        accountNumber: payload.accountNumber,
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
