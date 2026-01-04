import { db } from "@finanzas/db";

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

  if (!counterpart) return null;

  return {
    counterpart,
    accounts: counterpart.accounts,
  };
}

export async function createCounterpart(data: any) {
  // Use transaction to upsert Person and create Counterpart
  return await db.$transaction(async (tx) => {
    // Upsert Person by RUT if provided, otherwise create new
    let person;
    if (data.rut && data.rut.trim() !== "") {
      person = await tx.person.upsert({
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
    } else {
      // Logic for no RUT: just create person?
      // Legacy code assumed RUT is key. But schema says optional.
      // If no RUT, we must create a Person. But we can't upsert without unique.
      // For now, let's assume we create a new Person if no RUT matches,
      // OR we just create.
      person = await tx.person.create({
        data: {
          rut: data.rut || `TEMP-${Date.now()}`, // Fallback if required
          names: data.name,
          email: data.email,
          personType: data.personType,
        },
      });
    }

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

export async function updateCounterpart(id: number, data: any) {
  return await db.$transaction(async (tx) => {
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
  payload: any
) {
  return await db.counterpartAccount.update({
    where: { id: accountId },
    data: payload,
  });
}
