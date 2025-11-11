import { getPool } from "../server/db.js";
import type { RowDataPacket } from "mysql2";

type AllergySeed = {
  name: string;
  slug: string;
  level: "type" | "category" | "subtype";
  parentSlug?: string;
  description?: string;
};

type InventorySeed = {
  name: string;
  description?: string;
  current_stock: number;
  allergySlug: string;
};

const allergyTypes: AllergySeed[] = [
  { name: "Reactivos", slug: "reactivos", level: "type" },
  { name: "Ambiental", slug: "ambiental", level: "category", parentSlug: "reactivos" },
  { name: "Alimentario", slug: "alimentario", level: "category", parentSlug: "reactivos" },
  { name: "Venenos", slug: "venenos", level: "category", parentSlug: "reactivos" },
  { name: "Látex y contacto", slug: "latex", level: "category", parentSlug: "reactivos" },
  { name: "Fármacos", slug: "farmacos", level: "category", parentSlug: "reactivos" },
  { name: "Ácaros", slug: "acaros", level: "subtype", parentSlug: "ambiental" },
  { name: "Hongos", slug: "hongos", level: "subtype", parentSlug: "ambiental" },
  { name: "Epitelios", slug: "epitelios", level: "subtype", parentSlug: "ambiental" },
  { name: "Pólenes", slug: "polenes", level: "subtype", parentSlug: "ambiental" },
  { name: "Alimentos", slug: "alimentos", level: "subtype", parentSlug: "alimentario" },
  { name: "Frutas y frutos", slug: "frutas", level: "subtype", parentSlug: "alimentario" },
  { name: "Proteínas animales", slug: "proteinas-animales", level: "subtype", parentSlug: "alimentario" },
  { name: "Venenos de himenópteros", slug: "venenos-himenopteros", level: "subtype", parentSlug: "venenos" },
  { name: "Látex y derivados", slug: "latex-derivados", level: "subtype", parentSlug: "latex" },
  { name: "Beta-lactámicos", slug: "beta-lactamicos", level: "subtype", parentSlug: "farmacos" },
  { name: "Haptenos", slug: "haptenos", level: "type" },
  { name: "Metales", slug: "metales", level: "category", parentSlug: "haptenos" },
  { name: "Fragancias", slug: "fragancias-haptenos", level: "category", parentSlug: "haptenos" },
  { name: "Conservantes", slug: "conservantes", level: "category", parentSlug: "haptenos" },
  { name: "Gomas y acelerantes", slug: "gomas", level: "category", parentSlug: "haptenos" },
  { name: "Acrilatos y tinturas", slug: "acrilatos", level: "category", parentSlug: "haptenos" },
  { name: "Filtros solares y resinas", slug: "resinas", level: "category", parentSlug: "haptenos" },
  { name: "Níquel", slug: "niquel", level: "subtype", parentSlug: "metales" },
  { name: "Cobalto", slug: "cobalto", level: "subtype", parentSlug: "metales" },
  { name: "Fragancia mix I", slug: "fragancia-mix-i", level: "subtype", parentSlug: "fragancias-haptenos" },
  { name: "Fragancia mix II", slug: "fragancia-mix-ii", level: "subtype", parentSlug: "fragancias-haptenos" },
  { name: "Kathon CG", slug: "kathon", level: "subtype", parentSlug: "conservantes" },
  { name: "Tiuram mix", slug: "tiuram-mix", level: "subtype", parentSlug: "gomas" },
  { name: "Carbamix", slug: "carbamix", level: "subtype", parentSlug: "gomas" },
  { name: "HEMA", slug: "hema", level: "subtype", parentSlug: "acrilatos" },
  { name: "PPD", slug: "ppd", level: "subtype", parentSlug: "acrilatos" },
  { name: "Resinas epoxi", slug: "resinas-epoxi", level: "subtype", parentSlug: "resinas" },
  { name: "Filtros solares", slug: "filtros-solares", level: "subtype", parentSlug: "resinas" },
];

const inventoryItems: InventorySeed[] = [
  {
    name: "Dermatophagoides pteronyssinus",
    description: "Der p 1/2 — base de pruebas de prick e inmunoterapia.",
    current_stock: 18,
    allergySlug: "acaros",
  },
  {
    name: "Dermatophagoides farinae",
    description: "Der f 1/2 — control de humedad para rinitis persistente.",
    current_stock: 15,
    allergySlug: "acaros",
  },
  {
    name: "Blomia tropicalis",
    description: "Sensibilización frecuente en clima templado-húmedo.",
    current_stock: 9,
    allergySlug: "acaros",
  },
  {
    name: "Alternaria alternata",
    description: "Alt a 1 — riesgo de crisis asmáticas graves.",
    current_stock: 7,
    allergySlug: "hongos",
  },
  {
    name: "Cladosporium herbarum",
    description: "Exposición aérea estacional.",
    current_stock: 6,
    allergySlug: "hongos",
  },
  {
    name: "Aspergillus fumigatus",
    description: "Implicado en ABPA y colonización bronquial.",
    current_stock: 4,
    allergySlug: "hongos",
  },
  {
    name: "Fel d 1 (Gato)",
    description: "Epitelio de gato — difícil control ambiental.",
    current_stock: 5,
    allergySlug: "epitelios",
  },
  {
    name: "Can f 1 (Perro)",
    description: "Variabilidad entre razas; útil en clínicas pediátricas.",
    current_stock: 5,
    allergySlug: "epitelios",
  },
  {
    name: "Gramíneas mixtas",
    description: "Lolium perenne / Phleum pratense; AIT efectiva primavera-verano.",
    current_stock: 10,
    allergySlug: "polenes",
  },
  {
    name: "Gramíneas (ryegrass)",
    description: "Complementario para temporadas altas.",
    current_stock: 6,
    allergySlug: "polenes",
  },
  {
    name: "Caseína (Leche)",
    description: "Componentes Bos d 8 / Bos d 5; la exposición horneada ayuda tolerancia.",
    current_stock: 6,
    allergySlug: "alimentos",
  },
  {
    name: "Ovomucoide (Huevo)",
    description: "Gal d 1 — marcador de persistencia.",
    current_stock: 5,
    allergySlug: "alimentos",
  },
  {
    name: "Ara h 2 (Maní)",
    description: "Indicador de riesgo de anafilaxia.",
    current_stock: 4,
    allergySlug: "alimentos",
  },
  {
    name: "Durazno / Pru p 3",
    description: "LTP con riesgo sistémico; educar sobre cofactores.",
    current_stock: 3,
    allergySlug: "frutas",
  },
  {
    name: "Parvalbúmina (Pescado)",
    description: "Gad c 1 — alta estabilidad, útil en panel pediátrico.",
    current_stock: 4,
    allergySlug: "proteinas-animales",
  },
  {
    name: "Tri a 19 (Trigo ω-5 Gliadina)",
    description: "Anafilaxia dependiente de ejercicio.",
    current_stock: 2,
    allergySlug: "alimentos",
  },
  {
    name: "Gly m 5 (Soya)",
    description: "Variabilidad clínica; ideal para seguimiento pediátrico.",
    current_stock: 3,
    allergySlug: "alimentos",
  },
  {
    name: "Beta-lactámicos (penicilina/amoxicilina)",
    description: "Panel básico para pruebas con PPL y mixto menores.",
    current_stock: 2,
    allergySlug: "beta-lactamicos",
  },
  {
    name: "Fragancia mix I",
    description: "Serie de haptenos aromáticos.",
    current_stock: 8,
    allergySlug: "fragancia-mix-i",
  },
  {
    name: "Fragancia mix II",
    description: "Serie complementaria para cosméticos.",
    current_stock: 6,
    allergySlug: "fragancia-mix-ii",
  },
  {
    name: "Kathon CG",
    description: "Metilisotiazolinonas / MCI.",
    current_stock: 5,
    allergySlug: "kathon",
  },
  {
    name: "Tiuram Mix",
    description: "Guantes y elásticos; monitorear reducción de stock.",
    current_stock: 6,
    allergySlug: "tiuram-mix",
  },
  {
    name: "Carbamix",
    description: "Contacto ocupacional en construcción.",
    current_stock: 3,
    allergySlug: "carbamix",
  },
  {
    name: "HEMA (Acrilatos)",
    description: "Uñas, odontología y adhesivos.",
    current_stock: 4,
    allergySlug: "hema",
  },
  {
    name: "PPD",
    description: "Tintes capilares y textiles.",
    current_stock: 2,
    allergySlug: "ppd",
  },
  {
    name: "Níquel sulfato",
    description: "Alergia ocupacional / joyería.",
    current_stock: 4,
    allergySlug: "niquel",
  },
  {
    name: "Cobalto",
    description: "Herramientas y cementos.",
    current_stock: 3,
    allergySlug: "cobalto",
  },
  {
    name: "Resinas epoxi",
    description: "Adhesivos y electrónica.",
    current_stock: 3,
    allergySlug: "resinas-epoxi",
  },
  {
    name: "Filtros solares (avobenzona / octocrileno)",
    description: "Serie para dermatitis de fotoalérgica.",
    current_stock: 2,
    allergySlug: "filtros-solares",
  },
];

const providers = [
  { rut: "76.123.456-7", name: "Laboratorio Alergia", contact_info: "contacto@labaler.com" },
  { rut: "79.234.567-1", name: "Química Bio", contact_info: "ventas@quimicabio.cl" },
  { rut: "80.345.678-9", name: "Reagentes Central", contact_info: "support@reagents.cl" },
];

const providerAccounts: Record<string, string[]> = {
  "76.123.456-7": ["00112233", "00112244"],
  "79.234.567-1": ["00223344"],
  "80.345.678-9": ["00334455", "00334466"],
};

async function seed() {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("DELETE FROM inventory_provider_checks");
    await connection.query("DELETE FROM inventory_item_providers");
    await connection.query("DELETE FROM provider_accounts");
    await connection.query("DELETE FROM inventory_providers");
    await connection.query("DELETE FROM inventory_items");
    await connection.query("DELETE FROM inventory_allergy_types");

    const typeMap = new Map<string, number>();
    for (const seed of allergyTypes) {
      const parentId = seed.parentSlug ? (typeMap.get(seed.parentSlug) ?? null) : null;
      const [result] = await connection.query(
        `INSERT INTO inventory_allergy_types (parent_id, name, slug, description, level) VALUES (?, ?, ?, ?, ?)`,
        [parentId, seed.name, seed.slug, seed.description ?? null, seed.level]
      );
      typeMap.set(seed.slug, Number((result as { insertId: number }).insertId));
    }

    const providerIds: Record<string, number> = {};
    for (const provider of providers) {
      const [result] = await connection.query(
        `INSERT INTO inventory_providers (rut, name, contact_info) VALUES (?, ?, ?)`,
        [provider.rut, provider.name, provider.contact_info]
      );
      providerIds[provider.rut] = Number((result as { insertId: number }).insertId);
    }

    for (const [rut, accounts] of Object.entries(providerAccounts)) {
      const providerId = providerIds[rut];
      for (const account of accounts) {
        await connection.query(`INSERT INTO provider_accounts (provider_id, account_identifier) VALUES (?, ?)`, [
          providerId,
          account,
        ]);
      }
    }

    const itemMap = new Map<string, number>();
    for (const item of inventoryItems) {
      const typeId = typeMap.get(item.allergySlug) ?? null;
      const [result] = await connection.query(
        `INSERT INTO inventory_items (category_id, name, description, current_stock, allergy_type_id) VALUES (NULL, ?, ?, ?, ?)`,
        [item.name, item.description ?? null, item.current_stock, typeId]
      );
      itemMap.set(item.name, Number((result as { insertId: number }).insertId));
    }

    for (const item of inventoryItems) {
      const itemId = itemMap.get(item.name)!;
      for (const provider of providers) {
        const providerId = providerIds[provider.rut];
        await connection.query(
          `INSERT INTO inventory_item_providers (item_id, provider_id, current_price, last_stock_check, last_price_check)
           VALUES (?, ?, ?, NOW(), NOW())`,
          [itemId, providerId, Math.round(Math.random() * 30000 + 10000)]
        );
      }
    }

    const [itemProviderRows] = await connection.query<RowDataPacket[]>(
      `SELECT id, item_id, provider_id, current_price FROM inventory_item_providers`
    );
    for (const row of itemProviderRows) {
      const priceValue = row.current_price != null ? Number(row.current_price) : null;
      const quantity = 3 + Math.floor(Math.random() * 6);
      await connection.query(
        `INSERT INTO inventory_provider_checks (item_provider_id, check_type, quantity, notes)
         VALUES (?, 'stock', ?, 'Auditoría inicial de stock')`,
        [row.id, quantity]
      );
      await connection.query(
        `INSERT INTO inventory_provider_checks (item_provider_id, check_type, price, notes)
         VALUES (?, 'price', ?, 'Precio referencial seed')`,
        [row.id, priceValue]
      );
    }

    await connection.commit();
    console.log("Seeded allergy inventory successfully.");
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

seed().catch((error) => {
  console.error("Failed to seed allergy inventory:", error);
  process.exit(1);
});
