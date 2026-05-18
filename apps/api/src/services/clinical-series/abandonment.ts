import { dbClinicalSeries as db } from "@finanzas/db/slices";

export type AbandonmentOutcome =
  | "DECLINED"
  | "OTHER"
  | "RESCHEDULED"
  | "UNREACHABLE"
  | "WILL_RETURN";

export interface AbandonmentContactRecord {
  id: number;
  seriesId: number;
  outcome: AbandonmentOutcome;
  notes: null | string;
  contactedById: number;
  contactedByName: null | string;
  contactedAt: string;
}

export async function createAbandonmentContact(params: {
  seriesId: number;
  outcome: AbandonmentOutcome;
  notes?: string;
  contactedById: number;
}): Promise<AbandonmentContactRecord> {
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
    outcome: contact.outcome as AbandonmentOutcome,
    notes: contact.notes,
    contactedById: contact.contactedById,
    contactedByName: person ? `${person.names} ${person.fatherName ?? ""}`.trim() : null,
    contactedAt: contact.contactedAt.toISOString(),
  };
}

export async function listAbandonmentContacts(seriesId: number): Promise<{
  contacts: AbandonmentContactRecord[];
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
    contacts: contacts.map((c: (typeof contacts)[number]): AbandonmentContactRecord => {
      const person = c.contactedBy.person;
      return {
        id: Number(c.id),
        seriesId: c.seriesId,
        outcome: c.outcome as AbandonmentOutcome,
        notes: c.notes,
        contactedById: c.contactedById,
        contactedByName: person ? `${person.names} ${person.fatherName ?? ""}`.trim() : null,
        contactedAt: c.contactedAt.toISOString(),
      };
    }),
  };
}
