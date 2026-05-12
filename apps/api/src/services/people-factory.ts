import { db } from "@finanzas/db";
import type { PersonType as PersonTypeEnum } from "@finanzas/db/models";
import { DomainError } from "../lib/errors.ts";
import { logEvent } from "../lib/logger.ts";
import { canonicalRutFilter, requireCanonicalRut, validateRut } from "../lib/rut.ts";

// Single source of truth for creating / resolving Person rows.
//
// Why centralised: the codebase historically had four entry points
// that called `db.person.create` directly (orpc/patients, orpc/users,
// modules/patients, plus bulk SQL imports outside the app). Three of
// them did NOT canonicalise + validate the RUT before insert, so the
// same identity could land twice in `people` under different DV
// digits (`24597904-5` vs `24597904-K`). The Ruminot duplicate that
// triggered this rewrite was one of 18 such pairs in production.
//
// All paths that materialise a Person — patient registration, user
// onboarding, scraped imports, ficha clínica matching — go through
// `findOrCreatePerson` from now on. The companion CHECK constraint
// in migration 20260512_rut_check_constraint blocks any bypass at the
// DB layer.
//
// Refs:
//   - SII Chile RUT specification (módulo 11)
//   - HHS HIPAA §164.312(c)(1) Integrity controls

export type PersonInput = {
  rut: string | null | undefined;
  names: string;
  fatherName?: string | null;
  motherName?: string | null;
  email?: string | null;
  phone?: string | null;
  personType?: PersonTypeEnum;
};

export type FindOrCreatePersonResult = {
  personId: number;
  created: boolean;
  rut: string | null;
};

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  return t === "" ? null : t;
}

function preferLonger(existing: string | null, incoming: string | null): string | null {
  if (!incoming) return existing;
  if (!existing) return incoming;
  return incoming.length > existing.length ? incoming : existing;
}

/**
 * Find a Person by canonical RUT (preferred) or by name match
 * (fallback when the input has no RUT). Creates a new row when no
 * candidate exists. NEVER inserts a duplicate keyed on canonical RUT.
 *
 * Throws DomainError("BAD_REQUEST") when the supplied RUT fails mod-11
 * validation — refuses to silently store invalid identities.
 */
export async function findOrCreatePerson(
  input: PersonInput,
): Promise<FindOrCreatePersonResult> {
  const names = trimOrNull(input.names) ?? "";
  if (!names) {
    throw new DomainError("BAD_REQUEST", "Person.names es obligatorio");
  }

  let canonicalRut: string | null = null;
  if (input.rut != null && trimOrNull(input.rut) != null) {
    try {
      canonicalRut = requireCanonicalRut(input.rut);
    } catch (err) {
      throw new DomainError(
        "BAD_REQUEST",
        err instanceof Error ? err.message : "RUT inválido",
        { rut: input.rut },
      );
    }
  }

  // RUT-keyed dedupe (preferred — the unique index people_rut_key
  // already enforces this at the DB layer).
  if (canonicalRut) {
    const existing = await db.person.findUnique({ where: { rut: canonicalRut } });
    if (existing) {
      // Backfill missing fields without overwriting populated ones.
      const mergedNames = preferLonger(existing.names, names) ?? existing.names;
      const merged = {
        names: mergedNames,
        fatherName: preferLonger(existing.fatherName, trimOrNull(input.fatherName ?? null)),
        motherName: preferLonger(existing.motherName, trimOrNull(input.motherName ?? null)),
        email: existing.email ?? trimOrNull(input.email ?? null),
        phone: existing.phone ?? trimOrNull(input.phone ?? null),
      };
      const changed =
        merged.names !== existing.names ||
        merged.fatherName !== existing.fatherName ||
        merged.motherName !== existing.motherName ||
        merged.email !== existing.email ||
        merged.phone !== existing.phone;
      if (changed) {
        await db.person.update({ where: { id: existing.id }, data: merged });
        logEvent("[people-factory] person enriched", { id: existing.id, rut: canonicalRut });
      }
      return { personId: existing.id, created: false, rut: canonicalRut };
    }
  }

  // Name-only path: skip and force the caller to provide a RUT (or
  // explicitly call createWithoutRut below). Silent name-based
  // matching is what produced the historical Ruminot-style duplicates.
  if (!canonicalRut) {
    throw new DomainError("BAD_REQUEST", "RUT es obligatorio para findOrCreatePerson", { names });
  }

  const created = await db.person.create({
    data: {
      rut: canonicalRut,
      names,
      fatherName: trimOrNull(input.fatherName ?? null),
      motherName: trimOrNull(input.motherName ?? null),
      email: trimOrNull(input.email ?? null),
      phone: trimOrNull(input.phone ?? null),
      personType: input.personType ?? "NATURAL",
    },
  });
  logEvent("[people-factory] person created", { id: created.id, rut: canonicalRut });
  return { personId: created.id, created: true, rut: canonicalRut };
}

/**
 * Escape hatch for the rare flows that legitimately persist a Person
 * before a RUT is known (e.g. ficha clínica xlsx without RUT — the
 * matcher in modules/clinical-records/match.ts uses this only after
 * exhausting RUT-based matching). Logged at INFO so the audit trail
 * shows when it was used.
 */
export async function createPersonWithoutRut(input: PersonInput): Promise<number> {
  const names = trimOrNull(input.names) ?? "";
  if (!names) throw new DomainError("BAD_REQUEST", "Person.names es obligatorio");
  const created = await db.person.create({
    data: {
      rut: null,
      names,
      fatherName: trimOrNull(input.fatherName ?? null),
      motherName: trimOrNull(input.motherName ?? null),
      email: trimOrNull(input.email ?? null),
      phone: trimOrNull(input.phone ?? null),
      personType: input.personType ?? "NATURAL",
    },
  });
  logEvent("[people-factory] person created without rut", { id: created.id, names });
  return created.id;
}

export { canonicalRutFilter, validateRut };
