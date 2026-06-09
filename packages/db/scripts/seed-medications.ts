/**
 * Seed the medication catalog with ~100 common Chilean allergy / respiratory
 * medications. Curated clinical starting set (the doctor refines it later);
 * the full ISP registry CSV loads on top via `source = "isp"`.
 *
 * Run from repo root:
 *   pnpm -F @finanzas/db exec node scripts/seed-medications.ts
 * or:
 *   cd packages/db && node scripts/seed-medications.ts
 *
 * Idempotent: upserts by (name, presentation) — re-running updates fields,
 * never duplicates. Requires packages/db/.env with DATABASE_URL.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

type Seed = {
  activeIngredient?: string;
  form?: string;
  genericName: string;
  laboratory?: string;
  name: string;
  presentation?: string;
};

// form values (forma farmacéutica): comprimido, jarabe, gotas, aerosol,
// inhalador, spray nasal, crema, solución inyectable, autoinyector.
const MEDICATIONS: Seed[] = [
  // ── 2nd-gen oral antihistamines ──────────────────────────────────────────
  { genericName: "Loratadina", name: "Clarityne", activeIngredient: "Loratadina", form: "comprimido", presentation: "10 mg" },
  { genericName: "Loratadina", name: "Loratadina", activeIngredient: "Loratadina", form: "jarabe", presentation: "5 mg/5 mL" },
  { genericName: "Desloratadina", name: "Aerius", activeIngredient: "Desloratadina", form: "comprimido", presentation: "5 mg" },
  { genericName: "Desloratadina", name: "Aerius", activeIngredient: "Desloratadina", form: "jarabe", presentation: "0,5 mg/mL" },
  { genericName: "Cetirizina", name: "Zyrtec", activeIngredient: "Cetirizina diclorhidrato", form: "comprimido", presentation: "10 mg" },
  { genericName: "Cetirizina", name: "Cetirizina", activeIngredient: "Cetirizina diclorhidrato", form: "gotas", presentation: "10 mg/mL" },
  { genericName: "Levocetirizina", name: "Xuzal", activeIngredient: "Levocetirizina diclorhidrato", form: "comprimido", presentation: "5 mg" },
  { genericName: "Levocetirizina", name: "Levocetirizina", activeIngredient: "Levocetirizina diclorhidrato", form: "gotas", presentation: "5 mg/mL" },
  { genericName: "Fexofenadina", name: "Allegra", activeIngredient: "Fexofenadina clorhidrato", form: "comprimido", presentation: "120 mg" },
  { genericName: "Fexofenadina", name: "Allegra", activeIngredient: "Fexofenadina clorhidrato", form: "comprimido", presentation: "180 mg" },
  { genericName: "Bilastina", name: "Bilaxten", activeIngredient: "Bilastina", form: "comprimido", presentation: "20 mg" },
  { genericName: "Ebastina", name: "Ebastel", activeIngredient: "Ebastina", form: "comprimido", presentation: "10 mg" },
  { genericName: "Ebastina", name: "Ebastel Forte", activeIngredient: "Ebastina", form: "comprimido", presentation: "20 mg" },
  { genericName: "Rupatadina", name: "Rupafin", activeIngredient: "Rupatadina fumarato", form: "comprimido", presentation: "10 mg" },
  { genericName: "Rupatadina", name: "Rupafin", activeIngredient: "Rupatadina fumarato", form: "solución oral", presentation: "1 mg/mL" },

  // ── 1st-gen antihistamines (still used) ──────────────────────────────────
  { genericName: "Clorfenamina", name: "Clorfenamina", activeIngredient: "Clorfenamina maleato", form: "comprimido", presentation: "4 mg" },
  { genericName: "Clorfenamina", name: "Clorfenamina", activeIngredient: "Clorfenamina maleato", form: "jarabe", presentation: "2 mg/5 mL" },
  { genericName: "Difenhidramina", name: "Benadryl", activeIngredient: "Difenhidramina clorhidrato", form: "comprimido", presentation: "50 mg" },
  { genericName: "Hidroxizina", name: "Hidroxizina", activeIngredient: "Hidroxizina clorhidrato", form: "comprimido", presentation: "25 mg" },
  { genericName: "Ketotifeno", name: "Zaditen", activeIngredient: "Ketotifeno fumarato", form: "comprimido", presentation: "1 mg" },
  { genericName: "Ketotifeno", name: "Zaditen", activeIngredient: "Ketotifeno fumarato", form: "jarabe", presentation: "1 mg/5 mL" },

  // ── Intranasal corticosteroids ───────────────────────────────────────────
  { genericName: "Budesonida", name: "Rhinocort", activeIngredient: "Budesonida", form: "spray nasal", presentation: "64 mcg/dosis" },
  { genericName: "Mometasona", name: "Nasonex", activeIngredient: "Mometasona furoato", form: "spray nasal", presentation: "50 mcg/dosis" },
  { genericName: "Fluticasona", name: "Flixonase", activeIngredient: "Fluticasona propionato", form: "spray nasal", presentation: "50 mcg/dosis" },
  { genericName: "Fluticasona furoato", name: "Avamys", activeIngredient: "Fluticasona furoato", form: "spray nasal", presentation: "27,5 mcg/dosis" },
  { genericName: "Beclometasona", name: "Beconase", activeIngredient: "Beclometasona dipropionato", form: "spray nasal", presentation: "50 mcg/dosis" },
  { genericName: "Triamcinolona", name: "Nasacort", activeIngredient: "Triamcinolona acetónido", form: "spray nasal", presentation: "55 mcg/dosis" },

  // ── Intranasal antihistamine / combos ────────────────────────────────────
  { genericName: "Azelastina", name: "Azelastina", activeIngredient: "Azelastina clorhidrato", form: "spray nasal", presentation: "140 mcg/dosis" },
  { genericName: "Azelastina + Fluticasona", name: "Dymista", activeIngredient: "Azelastina clorhidrato + Fluticasona propionato", form: "spray nasal", presentation: "137/50 mcg/dosis" },

  // ── Inhaled corticosteroids (asma) ───────────────────────────────────────
  { genericName: "Budesonida", name: "Pulmicort", activeIngredient: "Budesonida", form: "inhalador", presentation: "200 mcg/dosis" },
  { genericName: "Budesonida", name: "Pulmicort Respules", activeIngredient: "Budesonida", form: "suspensión para nebulizar", presentation: "0,5 mg/2 mL" },
  { genericName: "Fluticasona", name: "Flixotide", activeIngredient: "Fluticasona propionato", form: "inhalador", presentation: "250 mcg/dosis" },
  { genericName: "Beclometasona", name: "Beclometasona", activeIngredient: "Beclometasona dipropionato", form: "inhalador", presentation: "250 mcg/dosis" },
  { genericName: "Ciclesonida", name: "Alvesco", activeIngredient: "Ciclesonida", form: "inhalador", presentation: "160 mcg/dosis" },
  { genericName: "Mometasona", name: "Asmanex", activeIngredient: "Mometasona furoato", form: "inhalador", presentation: "200 mcg/dosis" },

  // ── ICS/LABA combinations ────────────────────────────────────────────────
  { genericName: "Fluticasona + Salmeterol", name: "Seretide", activeIngredient: "Fluticasona propionato + Salmeterol", form: "inhalador", presentation: "250/25 mcg/dosis" },
  { genericName: "Fluticasona + Salmeterol", name: "Seretide Diskus", activeIngredient: "Fluticasona propionato + Salmeterol", form: "inhalador de polvo seco", presentation: "250/50 mcg/dosis" },
  { genericName: "Budesonida + Formoterol", name: "Symbicort", activeIngredient: "Budesonida + Formoterol fumarato", form: "inhalador", presentation: "160/4,5 mcg/dosis" },
  { genericName: "Beclometasona + Formoterol", name: "Foster", activeIngredient: "Beclometasona dipropionato + Formoterol", form: "inhalador", presentation: "100/6 mcg/dosis" },
  { genericName: "Fluticasona furoato + Vilanterol", name: "Relvar Ellipta", activeIngredient: "Fluticasona furoato + Vilanterol", form: "inhalador de polvo seco", presentation: "92/22 mcg/dosis" },

  // ── Leukotriene receptor antagonists ─────────────────────────────────────
  { genericName: "Montelukast", name: "Singulair", activeIngredient: "Montelukast sódico", form: "comprimido", presentation: "10 mg" },
  { genericName: "Montelukast", name: "Singulair", activeIngredient: "Montelukast sódico", form: "comprimido masticable", presentation: "5 mg" },
  { genericName: "Montelukast", name: "Singulair", activeIngredient: "Montelukast sódico", form: "comprimido masticable", presentation: "4 mg" },
  { genericName: "Montelukast", name: "Montelukast", activeIngredient: "Montelukast sódico", form: "granulado", presentation: "4 mg" },
  { genericName: "Zafirlukast", name: "Accolate", activeIngredient: "Zafirlukast", form: "comprimido", presentation: "20 mg" },

  // ── Short-acting bronchodilators (SABA / SAMA) ───────────────────────────
  { genericName: "Salbutamol", name: "Ventolin", activeIngredient: "Salbutamol", form: "inhalador", presentation: "100 mcg/dosis" },
  { genericName: "Salbutamol", name: "Salbutamol", activeIngredient: "Salbutamol", form: "solución para nebulizar", presentation: "5 mg/mL" },
  { genericName: "Fenoterol", name: "Berotec", activeIngredient: "Fenoterol bromhidrato", form: "inhalador", presentation: "100 mcg/dosis" },
  { genericName: "Ipratropio", name: "Atrovent", activeIngredient: "Ipratropio bromuro", form: "inhalador", presentation: "20 mcg/dosis" },
  { genericName: "Fenoterol + Ipratropio", name: "Berodual", activeIngredient: "Fenoterol bromhidrato + Ipratropio bromuro", form: "inhalador", presentation: "50/20 mcg/dosis" },

  // ── Long-acting bronchodilators (LABA / LAMA) ────────────────────────────
  { genericName: "Formoterol", name: "Foradil", activeIngredient: "Formoterol fumarato", form: "inhalador de polvo seco", presentation: "12 mcg/dosis" },
  { genericName: "Salmeterol", name: "Serevent", activeIngredient: "Salmeterol xinafoato", form: "inhalador", presentation: "25 mcg/dosis" },
  { genericName: "Indacaterol", name: "Onbrez", activeIngredient: "Indacaterol maleato", form: "inhalador de polvo seco", presentation: "150 mcg/dosis" },
  { genericName: "Tiotropio", name: "Spiriva", activeIngredient: "Tiotropio bromuro", form: "inhalador de polvo seco", presentation: "18 mcg/dosis" },

  // ── Systemic corticosteroids ─────────────────────────────────────────────
  { genericName: "Prednisona", name: "Prednisona", activeIngredient: "Prednisona", form: "comprimido", presentation: "5 mg" },
  { genericName: "Prednisona", name: "Prednisona", activeIngredient: "Prednisona", form: "comprimido", presentation: "20 mg" },
  { genericName: "Prednisolona", name: "Prednisolona", activeIngredient: "Prednisolona", form: "comprimido", presentation: "5 mg" },
  { genericName: "Prednisolona", name: "Prednisolona", activeIngredient: "Prednisolona", form: "gotas", presentation: "3 mg/mL" },
  { genericName: "Betametasona", name: "Cidoten", activeIngredient: "Betametasona", form: "comprimido", presentation: "0,5 mg" },
  { genericName: "Betametasona", name: "Cidoten", activeIngredient: "Betametasona fosfato sódico", form: "solución inyectable", presentation: "4 mg/mL" },
  { genericName: "Deflazacort", name: "Calcort", activeIngredient: "Deflazacort", form: "comprimido", presentation: "6 mg" },
  { genericName: "Deflazacort", name: "Calcort", activeIngredient: "Deflazacort", form: "comprimido", presentation: "30 mg" },
  { genericName: "Dexametasona", name: "Dexametasona", activeIngredient: "Dexametasona", form: "comprimido", presentation: "4 mg" },
  { genericName: "Dexametasona", name: "Dexametasona", activeIngredient: "Dexametasona fosfato sódico", form: "solución inyectable", presentation: "4 mg/mL" },
  { genericName: "Metilprednisolona", name: "Solu-Medrol", activeIngredient: "Metilprednisolona", form: "solución inyectable", presentation: "40 mg" },
  { genericName: "Hidrocortisona", name: "Hidrocortisona", activeIngredient: "Hidrocortisona succinato sódico", form: "solución inyectable", presentation: "100 mg" },

  // ── Adrenaline / epinephrine (anafilaxia) ────────────────────────────────
  { genericName: "Adrenalina", name: "Adrenalina", activeIngredient: "Epinefrina", form: "solución inyectable", presentation: "1 mg/mL (1:1000)" },
  { genericName: "Adrenalina", name: "EpiPen", activeIngredient: "Epinefrina", form: "autoinyector", presentation: "0,3 mg" },
  { genericName: "Adrenalina", name: "EpiPen Jr", activeIngredient: "Epinefrina", form: "autoinyector", presentation: "0,15 mg" },

  // ── Topical corticosteroids / antihistamines (piel) ──────────────────────
  { genericName: "Hidrocortisona", name: "Hidrocortisona", activeIngredient: "Hidrocortisona acetato", form: "crema", presentation: "1%" },
  { genericName: "Betametasona", name: "Betnovate", activeIngredient: "Betametasona valerato", form: "crema", presentation: "0,1%" },
  { genericName: "Mometasona", name: "Elocom", activeIngredient: "Mometasona furoato", form: "crema", presentation: "0,1%" },
  { genericName: "Clobetasol", name: "Dermovate", activeIngredient: "Clobetasol propionato", form: "crema", presentation: "0,05%" },
  { genericName: "Metilprednisolona aceponato", name: "Advantan", activeIngredient: "Metilprednisolona aceponato", form: "crema", presentation: "0,1%" },
  { genericName: "Pimecrolimus", name: "Elidel", activeIngredient: "Pimecrolimus", form: "crema", presentation: "1%" },
  { genericName: "Tacrolimus", name: "Protopic", activeIngredient: "Tacrolimus", form: "pomada", presentation: "0,1%" },
  { genericName: "Difenhidramina", name: "Caladryl", activeIngredient: "Difenhidramina + Calamina", form: "loción", presentation: "tópica" },

  // ── Ophthalmic antiallergics (colirios) ──────────────────────────────────
  { genericName: "Olopatadina", name: "Patanol", activeIngredient: "Olopatadina clorhidrato", form: "colirio", presentation: "0,1%" },
  { genericName: "Olopatadina", name: "Pataday", activeIngredient: "Olopatadina clorhidrato", form: "colirio", presentation: "0,2%" },
  { genericName: "Ketotifeno", name: "Zaditen Oftálmico", activeIngredient: "Ketotifeno fumarato", form: "colirio", presentation: "0,025%" },
  { genericName: "Epinastina", name: "Relestat", activeIngredient: "Epinastina clorhidrato", form: "colirio", presentation: "0,05%" },
  { genericName: "Cromoglicato de sodio", name: "Cromoglicato", activeIngredient: "Cromoglicato de sodio", form: "colirio", presentation: "2%" },
  { genericName: "Cromoglicato de sodio", name: "Cromoglicato", activeIngredient: "Cromoglicato de sodio", form: "spray nasal", presentation: "2%" },
  { genericName: "Nafazolina + Feniramina", name: "Naphcon-A", activeIngredient: "Nafazolina + Feniramina", form: "colirio", presentation: "tópico" },

  // ── Biologics (asma/urticaria grave) ─────────────────────────────────────
  { genericName: "Omalizumab", name: "Xolair", activeIngredient: "Omalizumab", form: "solución inyectable", presentation: "150 mg" },
  { genericName: "Mepolizumab", name: "Nucala", activeIngredient: "Mepolizumab", form: "solución inyectable", presentation: "100 mg" },
  { genericName: "Dupilumab", name: "Dupixent", activeIngredient: "Dupilumab", form: "solución inyectable", presentation: "300 mg" },
  { genericName: "Benralizumab", name: "Fasenra", activeIngredient: "Benralizumab", form: "solución inyectable", presentation: "30 mg" },

  // ── Mast cell stabilizers / others ───────────────────────────────────────
  { genericName: "Teofilina", name: "Teofilina", activeIngredient: "Teofilina anhidra", form: "comprimido de liberación prolongada", presentation: "300 mg" },
  { genericName: "Montelukast + Levocetirizina", name: "Montelukast/Levocetirizina", activeIngredient: "Montelukast + Levocetirizina", form: "comprimido", presentation: "10/5 mg" },
  { genericName: "Loratadina + Pseudoefedrina", name: "Clarityne-D", activeIngredient: "Loratadina + Pseudoefedrina", form: "comprimido", presentation: "5/120 mg" },
  { genericName: "Desloratadina + Pseudoefedrina", name: "Aerius-D", activeIngredient: "Desloratadina + Pseudoefedrina", form: "comprimido", presentation: "2,5/120 mg" },
  { genericName: "Fexofenadina + Pseudoefedrina", name: "Allegra-D", activeIngredient: "Fexofenadina + Pseudoefedrina", form: "comprimido", presentation: "60/120 mg" },
  { genericName: "Cetirizina + Pseudoefedrina", name: "Zyrtec-D", activeIngredient: "Cetirizina + Pseudoefedrina", form: "comprimido", presentation: "5/120 mg" },

  // ── Nasal saline / decongestants (soporte) ───────────────────────────────
  { genericName: "Cloruro de sodio", name: "Suero fisiológico nasal", activeIngredient: "Cloruro de sodio", form: "spray nasal", presentation: "0,9%" },
  { genericName: "Oximetazolina", name: "Afrin", activeIngredient: "Oximetazolina clorhidrato", form: "spray nasal", presentation: "0,05%" },
  { genericName: "Xilometazolina", name: "Otrivin", activeIngredient: "Xilometazolina clorhidrato", form: "spray nasal", presentation: "0,1%" },
];

async function main(): Promise<void> {
  const { db } = await import("@finanzas/db");
  console.log(`🌱 Seeding ${MEDICATIONS.length} medications...`);

  let created = 0;
  let updated = 0;

  for (const med of MEDICATIONS) {
    const existing = await db.medication.findFirst({
      where: { name: med.name, presentation: med.presentation ?? null },
    });

    const data = {
      activeIngredient: med.activeIngredient ?? null,
      form: med.form ?? null,
      genericName: med.genericName,
      laboratory: med.laboratory ?? null,
      name: med.name,
      presentation: med.presentation ?? null,
      source: "curated",
    };

    if (existing) {
      await db.medication.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await db.medication.create({ data });
      created += 1;
    }
  }

  console.log(`✅ Done. created=${created} updated=${updated} total=${MEDICATIONS.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
