import { type CounterpartCategory, db, type Person, type PersonType } from "@finanzas/db";
import type { CounterpartAccountUpdateArgs } from "@finanzas/db/input";

type CounterpartAccountUpdateInput = NonNullable<CounterpartAccountUpdateArgs["data"]>;

export type CounterpartPayload = {
  category?: CounterpartCategory;
  email?: string | null;
  employeeEmail?: string | null;
  employeeId?: number | null;
  name: string;
  notes?: string | null;
  personType?: "PERSON" | "COMPANY" | "OTHER";
  rut?: string | null;
};

export type CounterpartUpdatePayload = Partial<CounterpartPayload>;

const mapPersonType = (value?: CounterpartPayload["personType"]): PersonType | undefined => {
  if (!value) {
    return undefined;
  }
  if (value === "COMPANY") {
    return "JURIDICAL";
  }
  return "NATURAL";
};

const normalizeRut = (rut?: string | null): string | undefined => {
  if (!rut) {
    return undefined;
  }
  const trimmed = rut.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export async function listCounterparts() {
  return await db.counterpart.findMany({
    orderBy: { person: { names: "asc" } },
    include: {
      accounts: true,
      person: true,
    },
  });
}

export async function getCounterpartById(id: number) {
  const counterpart = await db.counterpart.findUnique({
    where: { id },
    include: {
      accounts: true,
      person: true,
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

export async function createCounterpart(data: CounterpartPayload) {
  // Use transaction to upsert Person and create Counterpart
  return await db.$transaction(async (tx) => {
    // Upsert Person by RUT if provided, otherwise create new
    let person: Person | null = null;
    const rut = normalizeRut(data.rut);
    const personType = mapPersonType(data.personType);
    if (rut) {
      person = await tx.person.upsert({
        where: { rut },
        update: {
          names: data.name,
          email: data.email ?? undefined,
          personType,
        },
        create: {
          rut,
          names: data.name,
          email: data.email ?? undefined,
          personType,
        },
      });
    } else {
      // Logic for no RUT: just create person?
      // Legacy code assumed RUT is key. But schema says optional.
      // If no RUT, we must create a Person. But we can't upsert without unique.
      // For now, let's assume we create a new Person if no RUT matches,
      // OR we just create.
      const fallbackRut = `TEMP-${Date.now()}`;
      person = await tx.person.create({
        data: {
          rut: fallbackRut, // Fallback if required
          names: data.name,
          email: data.email ?? undefined,
          personType,
        },
      });
    }

    return await tx.counterpart.create({
      data: {
        personId: person.id,
        category: data.category,
        notes: data.notes,
      },
      include: { person: true, accounts: true },
    });
  });
}

export async function updateCounterpart(id: number, data: CounterpartUpdatePayload) {
  return await db.$transaction(async (tx) => {
    const counterpart = await tx.counterpart.findUnique({ where: { id } });
    if (!counterpart) {
      throw new Error("Counterpart not found");
    }

    if (data.rut || data.name || data.email || data.personType) {
      const personType = mapPersonType(data.personType);
      await tx.person.update({
        where: { id: counterpart.personId },
        data: {
          rut: normalizeRut(data.rut),
          names: data.name,
          email: data.email ?? undefined,
          personType,
        },
      });
    }

    return await tx.counterpart.update({
      where: { id },
      data: {
        category: data.category,
        notes: data.notes,
      },
      include: { person: true, accounts: true },
    });
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
