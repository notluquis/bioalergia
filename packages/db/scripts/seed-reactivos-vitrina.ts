/**
 * Seed the B2B "vitrina" (página /venta-empresas) with the Inmunodiagnóstico
 * catalog that Bioalergia resells. Each row becomes a `QuoteProduct`.
 *
 * IMPORTANT:
 *  - `unitPrice` is seeded as 0 (placeholder). The public vitrina NEVER exposes
 *    price; an admin sets the real internal price later in /settings/reactivos-catalog.
 *  - `publishedOnSite` is seeded as `false`. Nothing shows on the public site
 *    until an admin reviews each row and toggles it on. This script never
 *    publishes anything by itself.
 *
 * Idempotent: upserts by `slug` (unique). Re-running updates catalog metadata
 * (brand, category, format, code) but PRESERVES `unitPrice`, `publishedOnSite`
 * and `isActive` for rows that already exist — so it never clobbers an admin's
 * pricing or publish decisions.
 *
 * Run from packages/db (Node 26 carga .env nativo):
 *   node --env-file=.env scripts/seed-reactivos-vitrina.ts --dry     # preview (default)
 *   node --env-file=.env scripts/seed-reactivos-vitrina.ts --apply   # write
 *
 * Source: inmunodiagnostico.cl catalog, verified 2026-06-21. Allergen extracts
 * are Roxall (2,5 mL prick-test line); codes are the supplier reference codes.
 */

type SeedProduct = {
  code?: string;
  brand?: string;
  category: string;
  name: string;
  format?: string;
};

const ALLERGEN = "Alérgenos — Prick Test";
const ALLERGEN_FMT = "2,5 mL";
const ROXALL = "Roxall";

const PRODUCTS: SeedProduct[] = [
  // ── Alérgenos prick test — Ácaros ──────────────────────────────────────────
  {
    code: "M-608",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Blomia tropicalis",
    format: ALLERGEN_FMT,
  },
  {
    code: "M-602",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Dermatophagoides farinae",
    format: ALLERGEN_FMT,
  },
  {
    code: "M-601",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Dermatophagoides pteronyssinus",
    format: ALLERGEN_FMT,
  },
  {
    code: "M-607",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Euroglyphus maynei",
    format: ALLERGEN_FMT,
  },
  {
    code: "M-603",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Lepidoglyphus destructor",
    format: ALLERGEN_FMT,
  },
  // ── Hongos ─────────────────────────────────────────────────────────────────
  {
    code: "P-901",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Alternaria alternata",
    format: ALLERGEN_FMT,
  },
  {
    code: "P-902",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Aspergillus fumigatus",
    format: ALLERGEN_FMT,
  },
  {
    code: "P-904",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Candida albicans",
    format: ALLERGEN_FMT,
  },
  {
    code: "P-905",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Cladosporium herbarum",
    format: ALLERGEN_FMT,
  },
  {
    code: "P-908",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Penicillium notatum",
    format: ALLERGEN_FMT,
  },
  // ── Gramíneas ──────────────────────────────────────────────────────────────
  {
    code: "G-102",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Cynodon dactylon / Pasto bermuda",
    format: ALLERGEN_FMT,
  },
  {
    code: "G-103",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Dactylis glomerata",
    format: ALLERGEN_FMT,
  },
  {
    code: "G-112",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Festuca pratensis / Coirón",
    format: ALLERGEN_FMT,
  },
  {
    code: "M-G01",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Mix gramíneas salvajes (Dactylis, Lolium, Phleum)",
    format: ALLERGEN_FMT,
  },
  {
    code: "G-105",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Lolium perenne / Ballica",
    format: ALLERGEN_FMT,
  },
  {
    code: "G-110",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Phleum pratense / Pasto Timothy",
    format: ALLERGEN_FMT,
  },
  {
    code: "G-111",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Poa pratensis / Espiguilla",
    format: ALLERGEN_FMT,
  },
  // ── Árboles ────────────────────────────────────────────────────────────────
  {
    code: "T-502",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Betula verrucosa / Abedul",
    format: ALLERGEN_FMT,
  },
  {
    code: "T-508",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Fraxinus excelsior / Fresno",
    format: ALLERGEN_FMT,
  },
  {
    code: "T-517",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Olea europaea / Olivo",
    format: ALLERGEN_FMT,
  },
  {
    code: "T-526",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Pinus pinea / Pino",
    format: ALLERGEN_FMT,
  },
  {
    code: "T-556",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Platanus acerifolia / Plátano oriental",
    format: ALLERGEN_FMT,
  },
  {
    code: "T-518",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Populus alba / Álamo",
    format: ALLERGEN_FMT,
  },
  {
    code: "T-506",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Quercus robur / Roble",
    format: ALLERGEN_FMT,
  },
  // ── Malezas ────────────────────────────────────────────────────────────────
  {
    code: "W-301",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Ambrosia artemisifolia / Ragweed",
    format: ALLERGEN_FMT,
  },
  {
    code: "W-304",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Amaranthus retroflexus / Bledo",
    format: ALLERGEN_FMT,
  },
  {
    code: "W-302",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Artemisa vulgaris / Mugwort",
    format: ALLERGEN_FMT,
  },
  {
    code: "W-305",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Chenopodium album / Cenizo",
    format: ALLERGEN_FMT,
  },
  {
    code: "W-306",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Parietaria judaica",
    format: ALLERGEN_FMT,
  },
  {
    code: "W-314",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Plantago lanceolata / Llantén",
    format: ALLERGEN_FMT,
  },
  {
    code: "W-312",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Rumex acetosella / Acederilla",
    format: ALLERGEN_FMT,
  },
  {
    code: "W-308",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Taraxacum officinale / Diente de león",
    format: ALLERGEN_FMT,
  },
  // ── Epitelios / Caspas ─────────────────────────────────────────────────────
  {
    code: "E-807",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Epitelio de caballo",
    format: ALLERGEN_FMT,
  },
  {
    code: "E-803",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Epitelio de conejo",
    format: ALLERGEN_FMT,
  },
  {
    code: "E-801",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Epitelio de gato",
    format: ALLERGEN_FMT,
  },
  {
    code: "E-805",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Epitelio de hámster",
    format: ALLERGEN_FMT,
  },
  {
    code: "E-802",
    brand: ROXALL,
    category: ALLERGEN,
    name: "Epitelio de perro",
    format: ALLERGEN_FMT,
  },

  // ── Test rápidos ───────────────────────────────────────────────────────────
  { category: "Test Rápidos", name: "Test Multivirus Respiratorios (8)" },
  {
    category: "Test Rápidos",
    name: "Test Multivirus Respiratorios (5) — SARS-CoV-2, AVR, VRS, FLU A/B, M. pneumoniae",
  },
  { category: "Test Rápidos", name: "Test Cryptococcus" },
  { category: "Test Rápidos", name: "Test de Tuberculosis" },
  { category: "Test Rápidos", name: "Test de Calprotectina" },
  { category: "Test Rápidos", name: "Panel de drogas en orina — Zopiclona" },
  { category: "Test Rápidos", name: "Panel de drogas en orina — Barbitúricos" },
  { category: "Test Rápidos", name: "Panel de drogas en orina — Fentanilo" },
  { category: "Test Rápidos", name: "Panel de drogas en orina — Cocaína" },
  { category: "Test Rápidos", name: "Panel de drogas en orina — Opiáceos" },
  { category: "Test Rápidos", name: "Test Alcohol en Saliva" },
  { brand: "UTAK", category: "Test Rápidos", name: "Drugs of Abuse Level 1 (control negativo)" },
  { brand: "UTAK", category: "Test Rápidos", name: "Drugs of Abuse Level 2 (control positivo)" },
  { brand: "UTAK", category: "Test Rápidos", name: "Orina certificada libre de droga" },

  // ── Látex y otras técnicas ─────────────────────────────────────────────────
  { category: "Látex y otras técnicas", name: "Test Strepto Grupos" },
  { category: "Látex y otras técnicas", name: "Test Factor Reumatoide (RF)" },
  { category: "Látex y otras técnicas", name: "Test ASLO (ASO)" },
  { category: "Látex y otras técnicas", name: "TPHA Látex" },
  { brand: "RapidLabs", category: "Látex y otras técnicas", name: "RPR RapidLabs" },
  { category: "Látex y otras técnicas", name: "Antígenos Febriles" },

  // ── Reactivos químicos y tinciones (Merck) ─────────────────────────────────
  { brand: "Merck", category: "Reactivos Químicos y Tinciones", name: "Entellan" },
  { brand: "Merck", category: "Reactivos Químicos y Tinciones", name: "Coagulasa" },
  {
    brand: "Merck",
    category: "Reactivos Químicos y Tinciones",
    name: "Formaldehído en solución 37%",
  },
  { brand: "Merck", category: "Reactivos Químicos y Tinciones", name: "Safranina" },
  { brand: "Merck", category: "Reactivos Químicos y Tinciones", name: "May-Grünwald" },
  { brand: "Merck", category: "Reactivos Químicos y Tinciones", name: "Giemsa" },
  { brand: "Merck", category: "Reactivos Químicos y Tinciones", name: "Hemacolor" },

  // ── Hematología ────────────────────────────────────────────────────────────
  {
    brand: "Mindray",
    category: "Reactivos de Hematología",
    name: "Reactivos línea Mindray BC-5000 / BC-5150",
  },
  {
    brand: "SYSMEX",
    category: "Reactivos de Hematología",
    name: "Reactivos línea SYSMEX XS (500i / 800i / 1000i)",
  },
  {
    brand: "Abbott",
    category: "Reactivos de Hematología",
    name: "Diferencial universal 3 partes (Abbott, Mindray BC, Human Count, Cell Dyn)",
  },

  // ── Estándares de drogas (Cerilliant) ──────────────────────────────────────
  { brand: "Cerilliant", category: "Estándares de Drogas", name: "Phenobarbital" },
  { brand: "Cerilliant", category: "Estándares de Drogas", name: "Alprazolam" },
  { brand: "Cerilliant", category: "Estándares de Drogas", name: "Benzoylecgonine" },
  { brand: "Cerilliant", category: "Estándares de Drogas", name: "Cocaine-D3" },
  { brand: "Cerilliant", category: "Estándares de Drogas", name: "Morphine" },
  { brand: "Cerilliant", category: "Estándares de Drogas", name: "Zopiclone" },

  // ── Tórulas y tubos ────────────────────────────────────────────────────────
  { category: "Tórulas y Tubos", name: "Tórula Nasofaríngea" },
  { brand: "Falcón", category: "Tórulas y Tubos", name: "Tubos Falcón 15 mL", format: "15 mL" },
  { brand: "Falcón", category: "Tórulas y Tubos", name: "Tubos Falcón 50 mL", format: "50 mL" },
  { category: "Tórulas y Tubos", name: "Medio de transporte viral inactivado" },

  // ── Insumos generales ──────────────────────────────────────────────────────
  { category: "Insumos Generales", name: "Set de dureza (tratamiento de agua)" },
  { category: "Insumos Generales", name: "Lámpara halógena" },
  { category: "Insumos Generales", name: "Termómetro de máxima y mínima" },
  { category: "Insumos Generales", name: "Termómetro higrómetro" },
  { category: "Insumos Generales", name: "Timer digital" },
  { category: "Insumos Generales", name: "Tiras reactivas de orina URS-10 (10 parámetros)" },
];

/** Slug estable a partir del nombre (sin tildes, kebab-case). */
function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { db } = await import("@finanzas/db");

  // Guard: slugs deben ser únicos en el set sembrado.
  const slugs = PRODUCTS.map((p) => slugify(p.name));
  const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  if (dupes.length > 0) {
    console.error("❌ Slugs duplicados en el seed:", [...new Set(dupes)]);
    process.exit(1);
  }

  console.log(
    `${apply ? "✍️  APPLY" : "👀 DRY-RUN"} — ${PRODUCTS.length} productos (publishedOnSite=false, unitPrice=0)`
  );

  let created = 0;
  let updated = 0;

  for (const p of PRODUCTS) {
    const slug = slugify(p.name);
    const existing = await db.quoteProduct.findUnique({ where: { slug } });

    if (existing) {
      // Re-run: refresca metadata del catálogo, PRESERVA precio/publish/active.
      if (apply) {
        await db.quoteProduct.update({
          where: { id: existing.id },
          data: {
            code: p.code ?? null,
            brand: p.brand ?? null,
            category: p.category,
            name: p.name,
            format: p.format ?? null,
          },
        });
      }
      updated += 1;
    } else {
      if (apply) {
        await db.quoteProduct.create({
          data: {
            code: p.code ?? null,
            brand: p.brand ?? null,
            category: p.category,
            name: p.name,
            format: p.format ?? null,
            slug,
            unitPrice: 0,
            isActive: true,
            publishedOnSite: false,
          },
        });
      }
      created += 1;
      if (!apply) console.log(`  + ${p.category} · ${p.name}`);
    }
  }

  console.log(
    `${apply ? "✅ Done." : "ℹ️  Preview."} nuevos=${created} existentes=${updated} total=${PRODUCTS.length}`
  );
  if (!apply)
    console.log(
      "   Corre con --apply para escribir. Luego publica en /settings/reactivos-catalog."
    );
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
