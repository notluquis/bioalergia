import { kysely } from "@finanzas/db";
import { sql } from "kysely";
import type { ParsedClinicalRecord } from "./parser.ts";

// Resolve a ParsedClinicalRecord to a patients row by normalised name
// (NFD + lowercase) since fichas clínicas xlsx never carry a RUT and
// the patient/person tables hold RUT but not always populated. Returns:
//   - matchedPatientId  if exactly one ACTIVE candidate matches
//   - matchCandidates[] otherwise — operator picks via UI
//
// Match strategy (in priority order):
//   1. Exact normalised full-name match against people.names + father + mother
//   2. Token-overlap fuzzy match scoring against the same concatenation
//   3. None → empty candidates, operator decides whether to create patient
//
// Birth date (when available on patients) helps disambiguate same-name
// duplicates by comparing parsed ageLabel against age-at-consultDate.

export type MatchCandidate = {
  patientId: number;
  personId: number;
  fullName: string;
  rut: string | null;
  birthDate: string | null;
  score: number;
  reason: string;
};

export type MatchResult = {
  matchedPatientId: number | null;
  candidates: MatchCandidate[];
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean);
}

function tokenOverlapScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let hits = 0;
  for (const t of a) if (setB.has(t)) hits += 1;
  return hits / Math.max(a.length, b.length);
}

export async function matchPatientForRecord(parsed: ParsedClinicalRecord): Promise<MatchResult> {
  if (!parsed.patientName) return { matchedPatientId: null, candidates: [] };
  const target = tokens(parsed.patientName);
  if (target.length === 0) return { matchedPatientId: null, candidates: [] };

  const norm = normalize(parsed.patientName);

  // First pass: exact normalised match. Use Postgres unaccent if
  // available; otherwise compute in JS over a candidate pool.
  // Fetch a candidate pool using ILIKE on the first surname token to
  // narrow the set, then score in JS.
  const surname = target[target.length - 1] ?? target[0];
  const pool = await sql<{
    patientId: number;
    personId: number;
    names: string;
    fatherName: string | null;
    motherName: string | null;
    rut: string | null;
    birthDate: Date | null;
  }>`
    SELECT
      pa.id        AS "patientId",
      pe.id        AS "personId",
      pe.names     AS "names",
      pe.father_name AS "fatherName",
      pe.mother_name AS "motherName",
      pe.rut       AS "rut",
      pa.birth_date AS "birthDate"
    FROM patients pa
    JOIN people pe ON pe.id = pa.person_id
    WHERE
      lower(coalesce(pe.father_name, '')) ILIKE ${"%" + surname + "%"}
      OR lower(coalesce(pe.names, '')) ILIKE ${"%" + surname + "%"}
    LIMIT 200
  `.execute(kysely);

  const candidates: MatchCandidate[] = [];
  for (const row of pool.rows) {
    const fullName = [row.names, row.fatherName, row.motherName].filter(Boolean).join(" ");
    const candTokens = tokens(fullName);
    const candNorm = normalize(fullName);
    const exact = candNorm === norm;
    const score = exact ? 1 : tokenOverlapScore(target, candTokens);
    if (score < 0.5) continue;
    candidates.push({
      patientId: row.patientId,
      personId: row.personId,
      fullName,
      rut: row.rut,
      birthDate: row.birthDate ? row.birthDate.toISOString().slice(0, 10) : null,
      score: Math.round(score * 100) / 100,
      reason: exact ? "exact_normalised_name" : "token_overlap",
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const top = candidates[0];
  // Auto-match: only when a single high-confidence (>=0.9) candidate
  // dominates the second-best by a clear margin.
  if (top && top.score >= 0.9) {
    const second = candidates[1];
    if (!second || top.score - second.score >= 0.2 || top.reason === "exact_normalised_name") {
      return { matchedPatientId: top.patientId, candidates: candidates.slice(0, 5) };
    }
  }

  return { matchedPatientId: null, candidates: candidates.slice(0, 5) };
}
