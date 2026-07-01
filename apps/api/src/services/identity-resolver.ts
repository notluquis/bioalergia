import { db } from "@finanzas/db";
import { logEvent } from "../lib/logger.ts";
import { validateRut } from "../lib/rut.ts";
import { createPersonWithoutRut, findOrCreatePerson } from "./people-factory.ts";

// ---------------------------------------------------------------------------
// Shared identity resolver — the "pulpo" spine. Every ingestion source
// (Doctoralia, DTE, skin-test, ficha, calendar) routes patient identity
// through here so the master `people`/`patients` tables stay the single
// source of truth instead of each feeder matching ad-hoc.
//
// Resolution tiers (strong → weak):
//   1. RUT (canonical, mod-11 valid)  → findOrCreatePerson (dedups by rut)
//   2. Doctoralia external id (stable) → Person.doctoraliaExternalId
//   3. no hard key                     → 'review' (NEVER auto-create: a
//      name-only create is exactly what produced the historical Ruminot
//      duplicates, see people-factory.ts).
//
// email/phone are ENRICHMENT signals, never keys — 159 emails / 167 phones
// are shared across Doctoralia patients (families), so keying on them would
// collide on the @unique email index.
// ---------------------------------------------------------------------------

export type ResolveIdentityInput = {
  rut?: string | null;
  names: string;
  fatherName?: string | null;
  motherName?: string | null;
  birthDate?: Date | null;
  doctoraliaExternalId?: number | null;
  phone?: string | null;
  email?: string | null;
  sex?: string | null;
};

export type ResolveAction = "linked" | "created" | "review";

export type ResolveIdentityResult = {
  personId: number | null;
  patientId: number | null;
  /** Whether a NEW Person was created (false when an existing one was reused). */
  created: boolean;
  action: ResolveAction;
};

/** Email is @unique on Person: only return it if no other Person holds it. */
async function emailIfFree(email: string | null | undefined): Promise<string | null> {
  const trimmed = email?.trim();
  if (!trimmed) return null;
  const taken = await db.person.findUnique({ where: { email: trimmed }, select: { id: true } });
  return taken ? null : trimmed;
}

/** Find the Patient for a Person, or create one; backfill birthDate when missing. */
async function ensurePatient(personId: number, birthDate: Date | null): Promise<number> {
  const existing = await db.patient.findUnique({
    where: { personId },
    select: { id: true, birthDate: true },
  });
  if (existing) {
    if (birthDate && !existing.birthDate) {
      await db.patient.update({ where: { id: existing.id }, data: { birthDate } });
    }
    return existing.id;
  }
  const created = await db.patient.create({
    data: { personId, birthDate: birthDate ?? null },
    select: { id: true },
  });
  return created.id;
}

/** Fill NULL contact/identity columns on an existing Person (never clobber). */
async function enrichExistingPerson(personId: number, input: ResolveIdentityInput): Promise<void> {
  const person = await db.person.findUnique({
    where: { id: personId },
    select: { email: true, phone: true, fatherName: true, motherName: true, sex: true },
  });
  if (!person) return;
  const data: Record<string, string> = {};
  if (!person.phone && input.phone?.trim()) data.phone = input.phone.trim();
  if (!person.fatherName && input.fatherName?.trim()) data.fatherName = input.fatherName.trim();
  if (!person.motherName && input.motherName?.trim()) data.motherName = input.motherName.trim();
  if (!person.sex && input.sex?.trim()) data.sex = input.sex.trim();
  if (!person.email) {
    const free = await emailIfFree(input.email);
    if (free) data.email = free;
  }
  if (Object.keys(data).length > 0) {
    await db.person.update({ where: { id: personId }, data });
  }
}

async function patientIdForPerson(personId: number): Promise<number | null> {
  const p = await db.patient.findUnique({ where: { personId }, select: { id: true } });
  return p?.id ?? null;
}

export async function resolvePerson(
  input: ResolveIdentityInput,
  opts: { createPatient?: boolean } = {}
): Promise<ResolveIdentityResult> {
  const names = input.names?.trim();
  if (!names) return { personId: null, patientId: null, created: false, action: "review" };

  const rut = input.rut && validateRut(input.rut) ? input.rut : null;

  // Tier 1 — RUT: hard key, findOrCreatePerson dedups + validates + enriches.
  if (rut) {
    const r = await findOrCreatePerson({
      rut,
      names,
      fatherName: input.fatherName ?? null,
      motherName: input.motherName ?? null,
      email: await emailIfFree(input.email),
      phone: input.phone ?? null,
      sex: input.sex ?? null,
      mergeStrategy: "enrich",
    });
    // Stamp the Doctoralia key on a RUT-matched Person too, so the calendar
    // linkage is recorded and re-syncs stay consistent. Best-effort: ignore
    // the @unique collision if this Person already carries a different id.
    if (input.doctoraliaExternalId != null) {
      await db.person
        .updateMany({
          where: { id: r.personId, doctoraliaExternalId: null },
          data: { doctoraliaExternalId: input.doctoraliaExternalId },
        })
        .catch(() => undefined);
    }
    const patientId = opts.createPatient
      ? await ensurePatient(r.personId, input.birthDate ?? null)
      : await patientIdForPerson(r.personId);
    return {
      personId: r.personId,
      patientId,
      created: r.created,
      action: r.created ? "created" : "linked",
    };
  }

  // Tier 2 — Doctoralia external id: stable dedup key for RUT-less patients.
  if (input.doctoraliaExternalId != null) {
    const existing = await db.person.findUnique({
      where: { doctoraliaExternalId: input.doctoraliaExternalId },
      select: { id: true },
    });
    let personId: number;
    let created = false;
    if (existing) {
      personId = existing.id;
      await enrichExistingPerson(personId, input);
    } else {
      personId = await createPersonWithoutRut({
        rut: null,
        names,
        fatherName: input.fatherName ?? null,
        motherName: input.motherName ?? null,
        email: await emailIfFree(input.email),
        phone: input.phone ?? null,
        sex: input.sex ?? null,
      });
      await db.person.update({
        where: { id: personId },
        data: { doctoraliaExternalId: input.doctoraliaExternalId },
      });
      created = true;
      logEvent("[identity-resolver] person created from doctoralia", {
        personId,
        doctoraliaExternalId: input.doctoraliaExternalId,
      });
    }
    const patientId = opts.createPatient
      ? await ensurePatient(personId, input.birthDate ?? null)
      : await patientIdForPerson(personId);
    return { personId, patientId, created, action: created ? "created" : "linked" };
  }

  // Tier 3 — no hard key: never auto-create (avoids name-only duplicates).
  return { personId: null, patientId: null, created: false, action: "review" };
}
