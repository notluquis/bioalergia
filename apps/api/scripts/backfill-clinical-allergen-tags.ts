#!/usr/bin/env node
/**
 * Backfill `ClinicalAllergen.tags` with EAACI cross-reactivity family
 * markers so the exam-report PDF generator's `hasCrossReactiveAllergens()`
 * (apps/intranet/src/features/exam-reports/lib/pdf.ts) can decide whether
 * to append the EAACI cross-reactivity disclaimer.
 *
 * Tag taxonomy (lower-case, single token per family):
 *   - pr-10         Bet v 1 homologs (PR-10 family). Birch + related
 *                   Fagales pollens; rosaceous fruits; nuts; celery/carrot;
 *                   soy.
 *   - profilin      Pan-allergen profilins (Bet v 2, Phl p 12 homologs).
 *                   Grass/tree pollens + cucurbits/citrus/tomato/banana.
 *   - tropomyosin   Invertebrate tropomyosin (Pen a 1, Der p 10, Bla g 7).
 *                   Crustaceans + house dust mites + cockroach.
 *   - ltp           Non-specific Lipid Transfer Proteins (Pru p 3
 *                   prototype). Peach + other rosaceous fruits + nuts +
 *                   peanut + tomato + mugwort pollen.
 *   - serum-albumin Mammalian serum albumins (Bos d 6, Fel d 2, Can f 3).
 *                   Cow milk/beef + cat/dog dander.
 *   - parvalbumin   Fish parvalbumins (Gad c 1 prototype).
 *   - lipocalin     Mammalian dander lipocalins (Fel d 4, Can f 1/2,
 *                   Equ c 1).
 *
 * Sources
 *   - EAACI Molecular Allergology User's Guide 2.0 (2022, with 2024 errata).
 *     https://hub.eaaci.org/resources_guidelines/molecular-allergology-users-guide-2-0/
 *   - WAO/EAACI Allergen Nomenclature DB (Matricardi et al.).
 *     http://www.allergen.org/
 *   - EAACI position paper on LTP syndrome (Skypala et al., 2021, Allergy).
 *     https://doi.org/10.1111/all.14947
 *
 * Idempotency
 *   The script MERGES new family tags into the existing `tags[]`. It never
 *   removes a tag a human (or another script) added. Re-running is safe.
 *   A row already carrying every family tag the rules would assign is
 *   skipped (no UPDATE issued).
 *
 * Usage
 *   Dry-run (default — prints counts, writes nothing):
 *     DATABASE_URL=postgres://... node apps/api/scripts/backfill-clinical-allergen-tags.ts
 *
 *   Apply:
 *     DATABASE_URL=postgres://... node apps/api/scripts/backfill-clinical-allergen-tags.ts --apply
 *
 * The script is a one-shot maintenance utility; not wired into CI.
 */
import { db } from "@finanzas/db";

const APPLY = process.argv.includes("--apply");

type TagFamily =
  | "pr-10"
  | "profilin"
  | "tropomyosin"
  | "ltp"
  | "serum-albumin"
  | "parvalbumin"
  | "lipocalin";

interface FamilyRule {
  readonly tag: TagFamily;
  // Per-family patterns. Each pattern is matched (case-insensitive) against
  // the allergen's normalized common name (Spanish), english name, and
  // scientific name. Patterns deliberately omit diacritics — names are
  // normalized first via `stripDiacritics()`.
  readonly patterns: readonly RegExp[];
}

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function norm(s: string | null | undefined): string {
  if (!s) return "";
  return stripDiacritics(s).toLowerCase();
}

// Rules: each pattern is permissive and intended to match Spanish common
// names as they appear in the BioAlergia catalog (lista_alergenos.xlsx),
// plus the matching English name and Linnaean genus/species when present.
//
// Overlap is expected and intentional (e.g. peach is BOTH a PR-10 fruit and
// the LTP prototype) — tags accumulate per row.
const RULES: readonly FamilyRule[] = [
  {
    tag: "pr-10",
    patterns: [
      // Fagales pollens (Bet v 1 source + sympatric trees)
      /\babedul\b|\bbirch\b|\bbetula\b/,
      /\baliso\b|\balder\b|\balnus\b/,
      /\bavellano\b|\bhazel\b|\bcorylus\b/,
      /\broble\b|\boak\b|\bquercus\b/,
      /\bcarpe\b|\bhornbeam\b|\bcarpinus\b/,
      /\bhaya\b|\bbeech\b|\bfagus\b/,
      /\bencina\b/,
      // PR-10 fruits, nuts, vegetables, legumes
      /\bmanzan/, // manzana
      /\bdurazno\b|\bmelocoton\b|\bpeach\b|\bprunus persica\b/,
      /\bcereza\b|\bcherry\b/,
      /\bpera\b|\bpear\b/,
      /\bciruela\b|\bplum\b/,
      /\bdamasco\b|\balbaricoque\b|\bapricot\b/,
      /\bkiwi\b/,
      /\bavellana\b|\bhazelnut\b/,
      /\bapio\b|\bcelery\b|\bapium\b/,
      /\bzanahoria\b|\bcarrot\b|\bdaucus\b/,
      /\bsoja\b|\bsoya\b|\bsoybean\b|\bglycine max\b/,
    ],
  },
  {
    tag: "profilin",
    patterns: [
      // Profilin sources — grass pollens
      /\bgramin/, // gramineas
      /\bgrass\b|\bphleum\b|\bcynodon\b|\blolium\b|\bpoa\b/,
      // Olive (Ole e 2 = profilin)
      /\bolivo\b|\bolea\b|\bolive\b/,
      // Profilin-rich plant foods
      /\btomate\b|\btomato\b/,
      /\bmelon\b/,
      /\bsandia\b|\bwatermelon\b/,
      /\bbanano\b|\bplatano\b|\bbanana\b/,
      /\bnaranja\b|\bmandarina\b|\blim[oó]n\b|\bcitric/, // citricos
      /\bpina\b|\bpineapple\b/,
    ],
  },
  {
    tag: "tropomyosin",
    patterns: [
      // Crustaceans
      /\bcamaron\b|\bshrimp\b|\bprawn\b|\bpenaeus\b/,
      /\blangost/, // langosta, langostino
      /\bcangrejo\b|\bcrab\b/,
      /\bjaiba\b/,
      /\bkrill\b/,
      // House dust mites
      /\bacaro\b|\bmite\b|\bdermatophagoides\b|\bder p\b|\bder f\b|\bblomia\b|\beuroglyphus\b/,
      // Cockroach
      /\bcucaracha\b|\bcockroach\b|\bblattella\b|\bperiplaneta\b/,
    ],
  },
  {
    tag: "ltp",
    patterns: [
      // LTP prototype + rosaceous fruits (LTP is in skin/peel)
      /\bdurazno\b|\bmelocoton\b|\bpeach\b|\bprunus persica\b/,
      /\bmanzan/,
      /\bcereza\b|\bcherry\b/,
      /\bciruela\b|\bplum\b/,
      // Tree nuts + peanut
      /\bnuez\b|\bwalnut\b|\bjuglans\b/,
      /\bavellana\b|\bhazelnut\b/,
      /\bmani\b|\bpeanut\b|\barachis\b/,
      /\balmendra\b|\balmond\b/,
      /\bcastana\b|\bchestnut\b/,
      // Other LTP foods
      /\btomate\b|\btomato\b/,
      /\bmaiz\b|\bcorn\b|\bzea mays\b/,
      /\buva\b|\bgrape\b|\bvitis\b/,
      // Mugwort (Art v 3 = LTP)
      /\bartemisa\b|\bmugwort\b|\bartemisia\b/,
    ],
  },
  {
    tag: "serum-albumin",
    patterns: [
      /\bleche\b|\bmilk\b/,
      /\bcarne\b.*\bvacun/,
      /\bbeef\b|\bbos taurus\b/,
      /\bgato\b|\bcat\b|\bfelis\b|\bfel d\b/,
      /\bperro\b|\bdog\b|\bcanis\b|\bcan f\b/,
      /\bcaballo\b|\bhorse\b|\bequus\b|\bequ c\b/,
    ],
  },
  {
    tag: "parvalbumin",
    patterns: [
      /\bpescado\b|\bfish\b/,
      /\batun\b|\btuna\b/,
      /\bsalmon\b/,
      /\bmerluza\b|\bhake\b/,
      /\bcongrio\b/,
      /\bbacalao\b|\bcod\b|\bgadus\b/,
      /\breineta\b|\bjurel\b|\bcaballa\b|\bmackerel\b/,
      /\bsardina\b|\bsardine\b/,
      /\btrucha\b|\btrout\b/,
    ],
  },
  {
    tag: "lipocalin",
    patterns: [
      /\bgato\b|\bcat\b|\bfelis\b|\bfel d\b/,
      /\bperro\b|\bdog\b|\bcanis\b|\bcan f\b/,
      /\bcaballo\b|\bhorse\b|\bequus\b|\bequ c\b/,
      /\bconejo\b|\brabbit\b|\boryctolagus\b/,
      /\bcobayo\b|\bcuy\b|\bguinea pig\b|\bcavia\b/,
      /\bhamster\b|\bratón\b|\braton\b|\bmouse\b|\brata\b|\brat\b|\bmus musculus\b|\brattus\b/,
    ],
  },
];

export interface AllergenRow {
  readonly id: string;
  readonly commonName: string;
  readonly englishName: string | null;
  readonly scientificName: string | null;
  readonly tags: readonly string[];
}

/**
 * Returns the set of family tags the rules assign to a single allergen.
 * Pure / synchronous so it's trivially unit-testable.
 */
export function tagsForAllergen(row: AllergenRow): readonly TagFamily[] {
  const haystack = [norm(row.commonName), norm(row.englishName), norm(row.scientificName)].join(" | ");
  const out = new Set<TagFamily>();
  for (const rule of RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(haystack)) {
        out.add(rule.tag);
        break;
      }
    }
  }
  return [...out];
}

/**
 * Merges new tags with existing ones, preserving order of existing entries
 * and appending new tags in family declaration order. Lower-cases on write
 * to match the schema comment.
 */
export function mergeTags(existing: readonly string[], add: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of existing) {
    const k = t.trim().toLowerCase();
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  for (const t of add) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("[backfill-tags] DATABASE_URL not set");
    process.exit(2);
  }

  console.log(`[backfill-tags] mode = ${APPLY ? "APPLY (writes)" : "DRY-RUN (no writes)"}`);

  const rows = await db.clinicalAllergen.findMany({
    where: { isActive: true },
    select: {
      id: true,
      commonName: true,
      englishName: true,
      scientificName: true,
      tags: true,
    },
  });

  console.log(`[backfill-tags] scanning ${rows.length} active allergens`);

  const familyCounts: Record<TagFamily, number> = {
    "pr-10": 0,
    profilin: 0,
    tropomyosin: 0,
    ltp: 0,
    "serum-albumin": 0,
    parvalbumin: 0,
    lipocalin: 0,
  };

  interface Plan {
    readonly id: string;
    readonly label: string;
    readonly existing: readonly string[];
    readonly add: readonly TagFamily[];
    readonly merged: readonly string[];
  }

  const plan: Plan[] = [];
  let skipped = 0;

  for (const r of rows) {
    const row: AllergenRow = {
      id: r.id,
      commonName: r.commonName,
      englishName: r.englishName,
      scientificName: r.scientificName,
      tags: r.tags ?? [],
    };
    const assigned = tagsForAllergen(row);
    if (assigned.length === 0) {
      skipped++;
      continue;
    }
    const existingLower = row.tags.map((t) => t.toLowerCase());
    const fresh = assigned.filter((t) => !existingLower.includes(t));
    if (fresh.length === 0) {
      skipped++;
      continue;
    }
    for (const t of fresh) familyCounts[t]++;
    plan.push({
      id: row.id,
      label: row.commonName,
      existing: row.tags,
      add: fresh,
      merged: mergeTags(row.tags, fresh),
    });
  }

  console.log("");
  console.log("[backfill-tags] family additions (rows that would gain each tag):");
  for (const fam of Object.keys(familyCounts) as TagFamily[]) {
    console.log(`  ${fam.padEnd(15)} ${familyCounts[fam]}`);
  }
  console.log("");
  console.log(`[backfill-tags] rows changed:    ${plan.length}`);
  console.log(`[backfill-tags] rows unchanged:  ${skipped}`);

  if (plan.length > 0) {
    const sample = plan.slice(0, 10);
    console.log("");
    console.log("[backfill-tags] sample (first 10):");
    for (const p of sample) {
      console.log(`  ${p.id} ${p.label} :: + [${p.add.join(", ")}]`);
    }
  }

  if (!APPLY) {
    console.log("");
    console.log("[backfill-tags] dry-run complete. Re-run with --apply to write.");
    return;
  }

  console.log("");
  console.log("[backfill-tags] applying...");
  let written = 0;
  for (const p of plan) {
    await db.clinicalAllergen.update({
      where: { id: p.id },
      data: { tags: [...p.merged] },
    });
    written++;
  }
  console.log(`[backfill-tags] wrote ${written} rows`);
}

await main();
