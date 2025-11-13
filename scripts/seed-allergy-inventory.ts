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

type BrandKey = "ALLOS CHILE" | "DIATER" | "Roxall Group";

type CatalogSeed = InventorySeed & {
  brand: BrandKey;
  volume: string;
  price: number;
};

const PROVIDER = {
  rut: "77.654.321-8",
  name: "Patricio Muñoz",
  contact_info: "patricio.munoz@proveedores.cl",
} as const;

const allergyTypes: AllergySeed[] = [
  { name: "Catálogo clínico de extractos", slug: "catalogo-extractos", level: "type" },
  { name: "Allos Chile", slug: "allos-chile", level: "category", parentSlug: "catalogo-extractos" },
  { name: "Diater", slug: "diater", level: "category", parentSlug: "catalogo-extractos" },
  { name: "Roxall Group", slug: "roxall-group", level: "category", parentSlug: "catalogo-extractos" },
  { name: "Allos Chile · viales 2.5 mL", slug: "allos-chile-extractos", level: "subtype", parentSlug: "allos-chile" },
  { name: "Diater · inyectables 2 mL", slug: "diater-extractos", level: "subtype", parentSlug: "diater" },
  { name: "Roxall Group · prick test 2.5 mL", slug: "roxall-prick", level: "subtype", parentSlug: "roxall-group" },
];

const brandSubtypeSlug: Record<BrandKey, string> = {
  "ALLOS CHILE": "allos-chile-extractos",
  DIATER: "diater-extractos",
  "Roxall Group": "roxall-prick",
};

const brandDisplayName: Record<BrandKey, string> = {
  "ALLOS CHILE": "Allos Chile",
  DIATER: "Diater",
  "Roxall Group": "Roxall Group",
};

const brandDescriptors: Record<BrandKey, string> = {
  "ALLOS CHILE": "línea ambiental y alimentaria importada",
  DIATER: "inmunoterapia y extractos clásicos 2 mL",
  "Roxall Group": "panel de prick-test listo para uso",
};

const brandBaseStock: Record<BrandKey, number> = {
  "ALLOS CHILE": 10,
  DIATER: 8,
  "Roxall Group": 6,
};

const brandBasePrice: Record<BrandKey, number> = {
  "ALLOS CHILE": 30500,
  DIATER: 33200,
  "Roxall Group": 35800,
};

const providers = [
  {
    rut: PROVIDER.rut,
    name: PROVIDER.name,
    contact_info: PROVIDER.contact_info,
  },
];

const providerAccounts: Record<string, string[]> = {
  [PROVIDER.rut]: ["CTA-BCI-009812", "CTA-SANTANDER-557201"],
};

const allergenCatalogEntries: Array<{ display: string; brand: BrandKey }> = [
  { display: "[E802] EPITELIO PERRO 2.5mL", brand: "ALLOS CHILE" },
  { display: "[F024] GAMBA / CAMARON 2.5mL", brand: "ALLOS CHILE" },
  { display: "[F040] ATÚN/TUNA 2.5mL", brand: "ALLOS CHILE" },
  { display: "[F092] PLATANO / BANANA 2.5mL", brand: "ALLOS CHILE" },
  { display: "[F093] CACAO 2.5 mL", brand: "ALLOS CHILE" },
  { display: "[G112] FESTUCA ALATIOR COIRON 2.5mL", brand: "ALLOS CHILE" },
  { display: "[G204] MAÍZ GRAMINEA, ZEA MAYS 2.5mL", brand: "ALLOS CHILE" },
  { display: "[T501] ARCE NEGUNDO / ARCE 2.5mL", brand: "ALLOS CHILE" },
  { display: "[T516] MORUS ALBA / MORERA 2.5mL", brand: "ALLOS CHILE" },
  { display: "[W305] CHENOPODIUM ALBUM / CENIZO 2.5mL", brand: "ALLOS CHILE" },
  { display: "[1304755] (W-305) DIATER. CHENOPODIUM ALBUM/ CENIZO 2 mL", brand: "DIATER" },
  { display: "[1304760] (M-G01) DIATER. GRAMÍNEAS SALVAJES (LOLIUM-POA-PHLEUM-DACTYLIS) 2 mL", brand: "DIATER" },
  { display: "[1304762] (G102) DIATER. CYNODON DACTYLON/PASTO BERMUDA 2 mL", brand: "DIATER" },
  { display: "[1304767] (G-103) DIATER. DACTYLIS GLOMERATA/ PASTO OVILLO 2 mL", brand: "DIATER" },
  { display: "[1304768] (G105) DIATER. LOLIUM PERENNE/ PASTO BALLICA 2mL", brand: "DIATER" },
  { display: "[1304769] (G-110) DIATER. PHLEUM PRATENSE/ PASTO TIMOTHY 2 mL", brand: "DIATER" },
  { display: "[1304770] (G111) DIATER. POA PRATENSIS/PASTO AZUL 2 mL", brand: "DIATER" },
  { display: "[1304773] (G-206) DIATER. TRITICUM AESTIVUM/ TRIGO 2 mL", brand: "DIATER" },
  { display: "[1304781] (W-306) DIATER. PARIETARIA JUDAICA 2 mL", brand: "DIATER" },
  { display: "[1304786] (W-314) DIATER. PLANTAGO LANCEOLATA/ LLANTÉN 2 mL", brand: "DIATER" },
  { display: "[1304791] (T-506) DIATER. QUERCUS ROBUR/ ROBLE 2 mL", brand: "DIATER" },
  { display: "[1304794] (W-312) DIATER. RUMEX ACETOSELLA / ACEDERILLA 2 mL", brand: "DIATER" },
  { display: "[1304797] (W308) DIATER. TARAXACUM OFFICINALE/ DIENTE DE LEON 2 mL", brand: "DIATER" },
  { display: "[1304803] (M608) DIATER. BLOMIA TROPICALIS 2 mL", brand: "DIATER" },
  { display: "[1304807] (M-603) DIATER. LEPIDOGLYPHUS DESTRUCTOR 2 mL", brand: "DIATER" },
  { display: "[1304817] (P904) DIATER. CANDIDA ALBICANS 1 mL", brand: "DIATER" },
  { display: "[1304818] (P-905) DIATER. CLADOSPORIUM HERBARUM 1 mL", brand: "DIATER" },
  { display: "[1304829] (E-803) DIATER. EPITELIO DE CONEJO 1 mL", brand: "DIATER" },
  { display: "[1304830] (E-801) DIATER. EPITELIO DE GATO 1 mL", brand: "DIATER" },
  { display: "[1304833] (E-802) DIATER. EPITELIO DE PERRO 1 mL", brand: "DIATER" },
  { display: "[1304846] (I-701) DIATER. BLATELLA GERMANICA/ CUCARACHA RUBIA 2 mL", brand: "DIATER" },
  { display: "[1304851] (I-703) DIATER. PERIPLANETA AMERICANA/ CUCARACHA AMERICANA 2 mL", brand: "DIATER" },
  { display: "[1304867] (F-002) DIATER. LECHE FRESCA DE VACA 2 mL", brand: "DIATER" },
  { display: "[1304869] (F-001) DIATER. CLARA DE HUEVO 2 mL", brand: "DIATER" },
  { display: "[1304872] (F-075) DIATER. YEMA DE HUEVO 2 mL", brand: "DIATER" },
  { display: "[1304874] (F-245) DIATER. HUEVO ENTERO 2 mL", brand: "DIATER" },
  { display: "[1304889] (F014) DIATER. HARINA DE SOJA 2 mL", brand: "DIATER" },
  { display: "[1304896] (F-044) DIATER. FRESA O FRUTILLA 2ML", brand: "DIATER" },
  { display: "[1304898] (F-084) DIATER. KIWI 2 mL", brand: "DIATER" },
  { display: "[1304903] (F087) DIATER. MELON 2 mL", brand: "DIATER" },
  { display: "[1304904] (F33) DIATER. NARANJA 2 mL", brand: "DIATER" },
  { display: "[1304935] (F15) DIATER. ALUBIA BLANCA/ POROTO 2 mL", brand: "DIATER" },
  { display: "[1304936] (F235) DIATER. LENTEJA 2mL", brand: "DIATER" },
  { display: "[1304938] (F026) DIATER. CARNE DE CERDO 2 mL", brand: "DIATER" },
  { display: "[1304941] (F-083) DIATER. CARNE DE POLLO 2 mL", brand: "DIATER" },
  { display: "[1304942] (F027) DIATER. CARNE DE VACA 2 mL", brand: "DIATER" },
  { display: "[1304943] (F-020) DIATER. ALMENDRA 2 mL", brand: "DIATER" },
  { display: "[1304946] (F-013) DIATER. CACAHUATE/ MANI 2 mL", brand: "DIATER" },
  { display: "[1304949] (F-256) DIATER. NUEZ NOGAL 2 mL", brand: "DIATER" },
  { display: "[1304954] (F-040) DIATER. ATUN 2 mL", brand: "DIATER" },
  { display: "[1304955] DIATER. BACALAO 2 mL", brand: "DIATER" },
  { display: "[1304960] (F-024) DIATER. CAMARON/ GAMBA 2 mL", brand: "DIATER" },
  { display: "[1304964] (F041) DIATER. SALMON 2 mL", brand: "DIATER" },
  { display: "[1306185] (F004) DIATER. HARINA DE TRIGO 2mL", brand: "DIATER" },
  { display: "[1306313] (F-095) DIATER. DURAZNO/ MELOCOTÓN 2 mL", brand: "DIATER" },
  { display: "[1307280] (W-301) DIATER. AMBROSIA ELIATOR/ARTEMISIIFOLIA 2 mL", brand: "DIATER" },
  { display: "[E-807] ROXALL. PRICK DE CABALLO 2.5mL", brand: "Roxall Group" },
  { display: "[G-110] ROXALL. PRICK PHLEUM PRATENSE 2.5mL", brand: "Roxall Group" },
  { display: "[G-205] ROXALL. PRICK SECALE CEREALE 2.5mL", brand: "Roxall Group" },
  { display: "[K-100] ROXALL. PRICK CONTROL NEGATIVO SSFG 2.5mL", brand: "Roxall Group" },
  { display: "[K-200] ROXALL. PRICK CONTROL POSITIVO HISTAMINA DIHIDROCLORURO 2.5mL", brand: "Roxall Group" },
  { display: "[L-001] ROXALL. Prick Test Hevea Brasiliensis, Latex 2.5mL", brand: "Roxall Group" },
  { display: "[M-601] ROXALL. PRICK DERMATHOPHAGOIDES PTERONYSSIUS 2.5 mL", brand: "Roxall Group" },
  { display: "[M-602] ROXALL. PRICK D. FARINAE 2.5mL", brand: "Roxall Group" },
  { display: "[M-603] ROXALL. PRICK LEPIDOGLYPHUS DESTRUCTOR 2.5mL", brand: "Roxall Group" },
  { display: "[P-901] ROXALL. PRICK ALTERNARIA ALTERNATA 2.5mL", brand: "Roxall Group" },
  { display: "[P-902] ROXALL. PRICK ASPERGILLUS FUMIGATUS 2.5mL", brand: "Roxall Group" },
  { display: "[P-905] ROXALL. PRICK CLADOSPORIUM HERBARUM 2.5mL", brand: "Roxall Group" },
  { display: "[P-908] ROXALL. PRICK PENICILLIUM NOTATUM 2.5mL", brand: "Roxall Group" },
  { display: "[T-502] ROXALL. PRICK BETULA VERRUCOSA / ABEDUL 2.5mL", brand: "Roxall Group" },
  { display: "[T-508] ROXALL. PRICK FRAXINUS EXCELSIOR / FRESNO 2.5mL", brand: "Roxall Group" },
  { display: "[T-517] ROXALL. PRICK OLEA EUROPEA / OLIVO 2.5mL", brand: "Roxall Group" },
  { display: "[T-524] ROXALL. CUPRESSUS ARIZONICA / CIPRES. 2.5mL", brand: "Roxall Group" },
  { display: "[T-556] ROXALL. PRICK PLATANUS ACERIFOLIA (PLATANUS ORIENTALIS) 2.5mL", brand: "Roxall Group" },
  { display: "[W-301] ROXALL. PRICK AMBROSIA ARTEMISIIFOLIA 2.5mL", brand: "Roxall Group" },
  { display: "[W-302] ROXALL. PRICK ARTEMISA VULGARIS 2.5mL", brand: "Roxall Group" },
  { display: "[W-306] ROXALL. PRICK PARIETARIA JUDAICA 2.5mL", brand: "Roxall Group" },
];

const SMALL_WORDS = new Set(["de", "del", "la", "las", "el", "los", "y", "o", "en", "con", "para", "por", "al", "a"]);

function extractCodes(display: string): { primary?: string; secondary?: string } {
  const primary = display.match(/\[([^[\]]+)]/);
  const secondary = display.match(/\(([^()]+)\)/);
  return {
    primary: primary?.[1]?.trim(),
    secondary: secondary?.[1]?.trim(),
  };
}

function extractVolume(display: string): string {
  const match = display.match(/(\d+(?:\.\d+)?)\s?mL/i);
  if (!match) {
    return "2 mL";
  }
  let value = match[1].replace(",", ".");
  if (value.endsWith(".0")) {
    value = value.slice(0, -2);
  }
  return `${value} mL`;
}

function stripMetadata(display: string, brand: BrandKey): string {
  const escapedBrand = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let result = display.replace(/\[[^\]]+]/g, "");
  result = result.replace(/\([^)]*\)/g, "");
  result = result.replace(new RegExp(escapedBrand, "gi"), "");
  result = result.replace(/DIATER\.?/gi, "");
  result = result.replace(/ROXALL\.?/gi, "");
  result = result.replace(/ALLOS CHILE\.?/gi, "");
  result = result.replace(/PRICK/gi, "Prick");
  result = result.replace(/\s*\/\s*/g, " / ");
  result = result.replace(/\s{2,}/g, " ");
  return result.trim().replace(/^[.-]+/, "");
}

function toTitleCaseSpanish(value: string): string {
  const tokens = value.toLocaleLowerCase("es-CL").split(" ");
  const transformed = tokens.map((token) => {
    if (!token) return token;
    if (token === "/") return token;
    if (SMALL_WORDS.has(token)) return token;
    if (token.includes("-")) {
      return token
        .split("-")
        .map((part) => (part ? part[0].toLocaleUpperCase("es-CL") + part.slice(1) : part))
        .join("-");
    }
    return token[0].toLocaleUpperCase("es-CL") + token.slice(1);
  });
  return transformed.join(" ");
}

function formatDisplayName(display: string, brand: BrandKey): { name: string; volume: string } {
  const { primary, secondary } = extractCodes(display);
  const rawLabel = stripMetadata(display, brand);
  const titleLabel = toTitleCaseSpanish(rawLabel)
    .replace(/(\d+(?:\.\d+)?) Ml/gi, "$1 mL")
    .replace(/Prick/gi, "Prick")
    .replace(/\s{2,}/g, " ")
    .trim();
  const volume = extractVolume(display);
  const brandLabel = brandDisplayName[brand];
  const includesVolume = titleLabel.toLowerCase().includes(volume.toLowerCase());
  const base = includesVolume ? titleLabel : `${titleLabel} ${volume}`;
  const codeParts = [primary, secondary].filter(Boolean);
  const prefix = codeParts.length ? `[${codeParts.join(" · ")}] ` : "";
  return { name: `${prefix}${base} · ${brandLabel}`, volume };
}

const catalogInventory: CatalogSeed[] = allergenCatalogEntries.map((entry, index) => {
  const { name, volume } = formatDisplayName(entry.display, entry.brand);
  const description = `${brandDisplayName[entry.brand]} · ${brandDescriptors[entry.brand]} · formato ${volume}. Proveedor ${PROVIDER.name}.`;
  const stock = brandBaseStock[entry.brand] + (index % 4);
  const price = brandBasePrice[entry.brand] + (index % 5) * 1250;
  return {
    name,
    description,
    current_stock: stock,
    allergySlug: brandSubtypeSlug[entry.brand],
    brand: entry.brand,
    volume,
    price,
  };
});

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
    for (const seedEntry of allergyTypes) {
      const parentId = seedEntry.parentSlug ? (typeMap.get(seedEntry.parentSlug) ?? null) : null;
      const [result] = await connection.query(
        `INSERT INTO inventory_allergy_types (parent_id, name, slug, description, level) VALUES (?, ?, ?, ?, ?)`,
        [parentId, seedEntry.name, seedEntry.slug, seedEntry.description ?? null, seedEntry.level]
      );
      typeMap.set(seedEntry.slug, Number((result as { insertId: number }).insertId));
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

    const itemMap = new Map<
      string,
      {
        id: number;
        price: number;
      }
    >();
    for (const item of catalogInventory) {
      const typeId = typeMap.get(item.allergySlug) ?? null;
      const [result] = await connection.query(
        `INSERT INTO inventory_items (category_id, name, description, current_stock, allergy_type_id) VALUES (NULL, ?, ?, ?, ?)`,
        [item.name, item.description ?? null, item.current_stock, typeId]
      );
      itemMap.set(item.name, { id: Number((result as { insertId: number }).insertId), price: item.price });
    }

    for (const item of catalogInventory) {
      const entry = itemMap.get(item.name);
      if (!entry) continue;
      const itemId = entry.id;
      const providerId = providerIds[PROVIDER.rut];
      await connection.query(
        `INSERT INTO inventory_item_providers (item_id, provider_id, current_price, last_stock_check, last_price_check)
         VALUES (?, ?, ?, NOW(), NOW())`,
        [itemId, providerId, entry.price]
      );
    }

    const [itemProviderRows] = await connection.query<RowDataPacket[]>(
      `SELECT id, item_id, provider_id, current_price FROM inventory_item_providers`
    );
    for (const row of itemProviderRows) {
      const priceValue = row.current_price != null ? Number(row.current_price) : null;
      const quantity = 4 + (Number(row.id) % 4);
      await connection.query(
        `INSERT INTO inventory_provider_checks (item_provider_id, check_type, quantity, notes)
         VALUES (?, 'stock', ?, 'Carga inicial proporcionada por Patricio Muñoz')`,
        [row.id, quantity]
      );
      await connection.query(
        `INSERT INTO inventory_provider_checks (item_provider_id, check_type, price, notes)
         VALUES (?, 'price', ?, 'Precio referencial catálogo 2025')`,
        [row.id, priceValue]
      );
    }

    await connection.commit();
    console.log("Seeded allergy inventory with Patricio Muñoz catalog.");
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
