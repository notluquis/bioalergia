import { db } from "@finanzas/db";

export async function createAbandonmentContact(params: {
  seriesId: number;
  outcome: string;
  notes?: string;
  contactedById: number;
}): Promise<{
  id: number;
  seriesId: number;
  outcome: string;
  notes: null | string;
  contactedById: number;
  contactedByName: null | string;
  contactedAt: string;
}> {
  const contact = await db.abandonmentContact.create({
    data: {
      seriesId: params.seriesId,
      outcome: params.outcome as never,
      notes: params.notes ?? null,
      contactedById: params.contactedById,
    },
    include: {
      contactedBy: {
        include: { person: { select: { names: true, fatherName: true } } },
      },
    },
  });

  const person = contact.contactedBy.person;
  return {
    id: Number(contact.id),
    seriesId: contact.seriesId,
    outcome: contact.outcome,
    notes: contact.notes,
    contactedById: contact.contactedById,
    contactedByName: person ? `${person.names} ${person.fatherName ?? ""}`.trim() : null,
    contactedAt: contact.contactedAt.toISOString(),
  };
}

export async function listAbandonmentContacts(seriesId: number): Promise<{
  contacts: Array<{
    id: number;
    seriesId: number;
    outcome: string;
    notes: null | string;
    contactedById: number;
    contactedByName: null | string;
    contactedAt: string;
  }>;
}> {
  const contacts = await db.abandonmentContact.findMany({
    where: { seriesId },
    orderBy: { contactedAt: "desc" },
    include: {
      contactedBy: {
        include: { person: { select: { names: true, fatherName: true } } },
      },
    },
  });

  return {
    contacts: contacts.map((c) => {
      const person = c.contactedBy.person;
      return {
        id: Number(c.id),
        seriesId: c.seriesId,
        outcome: c.outcome,
        notes: c.notes,
        contactedById: c.contactedById,
        contactedByName: person ? `${person.names} ${person.fatherName ?? ""}`.trim() : null,
        contactedAt: c.contactedAt.toISOString(),
      };
    }),
  };
}
