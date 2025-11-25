import { prisma } from "../prisma.js";
import { PersonType, CounterpartCategory } from "../../generated/prisma/client.js";

export type CreateCounterpartPayload = {
  rut: string;
  name: string;
  personType: PersonType;
  category: CounterpartCategory;
  email?: string | null;
  employeeId?: number | null;
  notes?: string | null;
};

export type UpdateCounterpartPayload = {
  rut?: string;
  name?: string;
  personType?: PersonType;
  category?: CounterpartCategory;
  email?: string | null;
  employeeId?: number | null;
  notes?: string | null;
};

export async function listCounterparts() {
  return await prisma.counterpart.findMany({
    orderBy: { person: { names: "asc" } },
    include: {
      accounts: true,
      person: true,
    },
  });
}

export async function getCounterpartById(id: number) {
  const counterpart = await prisma.counterpart.findUnique({
    where: { id },
    include: {
      accounts: true,
      person: true,
    },
  });

  if (!counterpart) return null;

  return {
    counterpart,
    accounts: counterpart.accounts,
  };
}

export async function createCounterpart(data: CreateCounterpartPayload) {
  return await prisma.$transaction(async (tx) => {
    // Upsert Person by RUT
    const person = await tx.person.upsert({
      where: { rut: data.rut },
      update: {
        names: data.name,
        email: data.email,
        personType: data.personType,
      },
      create: {
        rut: data.rut,
        names: data.name,
        email: data.email,
        personType: data.personType,
      },
    });

    // Create Counterpart linked to Person
    return await tx.counterpart.create({
      data: {
        personId: person.id,
        category: data.category,
        notes: data.notes,
      },
      include: { person: true },
    });
  });
}

export async function updateCounterpart(id: number, data: UpdateCounterpartPayload) {
  return await prisma.$transaction(async (tx) => {
    const counterpart = await tx.counterpart.findUnique({ where: { id } });
    if (!counterpart) throw new Error("Counterpart not found");

    if (data.rut || data.name || data.email || data.personType) {
      await tx.person.update({
        where: { id: counterpart.personId },
        data: {
          rut: data.rut,
          names: data.name,
          email: data.email,
          personType: data.personType,
        },
      });
    }

    return await tx.counterpart.update({
      where: { id },
      data: {
        category: data.category,
        notes: data.notes,
      },
      include: { person: true },
    });
  });
}

export async function upsertCounterpartAccount(
  counterpartId: number,
  payload: {
    accountNumber: string;
    bankName?: string | null;
    accountType?: string | null;
  }
) {
  const existing = await prisma.counterpartAccount.findFirst({
    where: {
      counterpartId,
      accountNumber: payload.accountNumber,
    },
  });

  if (existing) {
    return await prisma.counterpartAccount
      .update({
        where: { id: existing.id },
        data: {
          bankName: payload.bankName,
          accountType: payload.accountType,
        },
      })
      .then((r) => r.id);
  } else {
    return await prisma.counterpartAccount
      .create({
        data: {
          counterpartId,
          accountNumber: payload.accountNumber,
          bankName: payload.bankName,
          accountType: payload.accountType,
        },
      })
      .then((r) => r.id);
  }
}

export async function updateCounterpartAccount(
  accountId: number,
  payload: {
    bankName?: string | null;
    accountType?: string | null;
    accountNumber?: string;
  }
) {
  return await prisma.counterpartAccount.update({
    where: { id: accountId },
    data: {
      bankName: payload.bankName,
      accountType: payload.accountType,
      accountNumber: payload.accountNumber,
    },
  });
}
