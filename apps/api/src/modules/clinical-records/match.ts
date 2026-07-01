import { kysely } from "@finanzas/db";
import { sql } from "kysely";
import jaroWinkler from "talisman/metrics/jaro-winkler.js";
import { symmetric as mongeElkanSymmetric } from "talisman/metrics/monge-elkan.js";
import { dbDateToISO, dbDateToMs } from "../../lib/time.ts";
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
  /** Name-only similarity (before age adjustment). Auto-match gates on this so
   *  an age coincidence can never manufacture a match to a wrong patient. */
  baseScore: number;
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

// Monge-Elkan (symmetric) over Jaro-Winkler per-token — the Splink (UK MoJ
// record-linkage) name-field algorithm, already used in dte-event-linking.ts.
// Replaces the old exact token-overlap: it scores typo'd surnames
// ("Villegas"~"Vellegas" JW≈0.94) and reordered names as near-matches, and the
// symmetric average doesn't penalise an extra middle name on either side. This
// lifts genuine same-person near-misses toward the 0.9 auto-threshold WITHOUT
// lowering that threshold. Tokens are sorted so word order doesn't matter.
function fuzzyNameScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  return mongeElkanSymmetric(jaroWinkler, [...a].sort(), [...b].sort());
}

// Convert Chilean age expressions to fractional years. Returns null
// when the expression is unparseable. Examples seen in the corpus:
//   "5 AÑOS"                 → 5
//   "11"                     → 11   (bare integer fallback)
//   "10 años"                → 10
//   "8 MESES 6 DIAS"         → 8/12 + 6/365 ≈ 0.683
//   "1 AÑO 10 MESES"         → 1.833
//   "5 MESES 15 DIAS - CORONEL" → 5/12 + 15/365 ≈ 0.458
//   "RNT 40 SEM - CESAREA"   → ~0 (recién nacido a término)
//   "RNT AEG 39 SEM"         → ~0
//
// The arithmetic uses 12 months and 365 days per year so the result
// is precise enough to disambiguate same-name candidates by birth
// year. Order-of-magnitude correctness is all that's required.
export function parseAgeLabelYears(label: string | null): number | null {
  if (!label) return null;
  const norm = label
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toUpperCase();
  if (/\bRNT\b|\bRECIEN NACIDO\b|\bRN\b/.test(norm)) return 0;
  let years = 0;
  let matched = false;
  const yr = norm.match(/(\d{1,3})\s*(?:AÑOS?|ANOS?)\b/);
  if (yr) {
    years += Number.parseInt(yr[1], 10);
    matched = true;
  }
  const mo = norm.match(/(\d{1,3})\s*(?:MESES?|MES)\b/);
  if (mo) {
    years += Number.parseInt(mo[1], 10) / 12;
    matched = true;
  }
  const dy = norm.match(/(\d{1,4})\s*(?:DIAS?|DIA)\b/);
  if (dy) {
    years += Number.parseInt(dy[1], 10) / 365;
    matched = true;
  }
  const wk = norm.match(/(\d{1,3})\s*(?:SEM|SEMANAS?)\b/);
  if (wk && !matched) {
    // SEM alone (e.g. "RNT 39 SEM") is gestational age → infant.
    return Number.parseInt(wk[1], 10) / 52;
  }
  if (matched) return years;
  // Bare integer fallback (e.g. "11" without unit).
  const bare = norm.match(/^\s*(\d{1,3})\s*$/);
  if (bare) return Number.parseInt(bare[1], 10);
  return null;
}

// Age delta → score adjustment. Boosts a candidate when the patient's
// birthDate-derived age at consultDate matches the parsed ageLabel,
// penalises when they're far apart. Patients without birthDate fall
// back to the token score unchanged.
function ageAdjustment(
  parsedYears: number | null,
  birthDate: Date | null,
  consultDate: string | null
): number {
  if (parsedYears == null || !birthDate || !consultDate) return 0;
  const consult = new Date(consultDate);
  if (Number.isNaN(consult.getTime())) return 0;
  const actualYears = (consult.getTime() - dbDateToMs(birthDate)) / (365.25 * 24 * 3600 * 1000);
  if (actualYears < 0) return -0.4;
  const diff = Math.abs(parsedYears - actualYears);
  if (diff < 0.25) return 0.3;
  if (diff < 1) return 0.1;
  if (diff < 3) return 0;
  if (diff < 8) return -0.2;
  return -0.4;
}

export async function matchPatientForRecord(parsed: ParsedClinicalRecord): Promise<MatchResult> {
  if (!parsed.patientName) return { matchedPatientId: null, candidates: [] };
  const target = tokens(parsed.patientName);
  if (target.length === 0) return { matchedPatientId: null, candidates: [] };

  const norm = normalize(parsed.patientName);

  // Candidate pool: search via unaccent + lower across names, father
  // and mother surnames. Use BOTH the first-name token AND the last
  // (probable surname) so single-name xlsx (raras pero existen) still
  // hit. Multiple tokens combined with OR keep the pool bounded while
  // catching variant orderings ("RUMINOT JOSE" vs "JOSE RUMINOT").
  const searchTokens = Array.from(new Set([target[0], target[target.length - 1]]));
  const searchTerms = searchTokens.map((t) => `%${t}%`);
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
      unaccent(lower(coalesce(pe.father_name, ''))) ILIKE ANY(${searchTerms})
      OR unaccent(lower(coalesce(pe.mother_name, ''))) ILIKE ANY(${searchTerms})
      OR unaccent(lower(coalesce(pe.names, ''))) ILIKE ANY(${searchTerms})
    LIMIT 200
  `.execute(kysely);

  const parsedYears = parseAgeLabelYears(parsed.ageLabel);
  const candidates: MatchCandidate[] = [];
  for (const row of pool.rows) {
    const fullName = [row.names, row.fatherName, row.motherName].filter(Boolean).join(" ");
    const candTokens = tokens(fullName);
    const candNorm = normalize(fullName);
    const exact = candNorm === norm;
    const baseScore = exact ? 1 : fuzzyNameScore(target, candTokens);
    if (baseScore < 0.5) continue;
    const ageBoost = ageAdjustment(parsedYears, row.birthDate, parsed.consultDate);
    const finalScore = Math.max(0, Math.min(1, baseScore + ageBoost));
    const reasons: string[] = [exact ? "exact_normalised_name" : "token_overlap"];
    if (ageBoost > 0) reasons.push("age_match");
    else if (ageBoost < 0) reasons.push("age_mismatch");
    candidates.push({
      patientId: row.patientId,
      personId: row.personId,
      fullName,
      rut: row.rut,
      birthDate: dbDateToISO(row.birthDate),
      score: Math.round(finalScore * 100) / 100,
      baseScore: Math.round(baseScore * 100) / 100,
      reason: reasons.join("+"),
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const top = candidates[0];
  // Auto-match: single high-confidence candidate that dominates the runner-up.
  // The gate is on baseScore (name-only) ≥ 0.9, NOT the age-boosted score — an
  // age coincidence must never lift a weak name ("Alonso Silva" vs "Domenica
  // Sunino Silva") over the bar. Age only re-ranks among strong name matches.
  if (top && top.score >= 0.9 && (top.baseScore >= 0.9 || top.reason.startsWith("exact"))) {
    const second = candidates[1];
    if (!second || top.score - second.score >= 0.2 || top.reason.startsWith("exact")) {
      return { matchedPatientId: top.patientId, candidates: candidates.slice(0, 5) };
    }
  }

  return { matchedPatientId: null, candidates: candidates.slice(0, 5) };
}
