import { db } from "@finanzas/db";
import type {
  CreateClinicalAllergenInput,
  UpdateClinicalAllergenInput,
} from "@finanzas/orpc-contracts/clinical-allergens";
import { DomainError } from "../lib/errors.ts";

// Normalización idéntica a la del importador de cutáneos: NFD + sin acentos +
// alfanumérico + UPPERCASE (espeja `normalized_common_name`/`normalized_alias`
// de las 239 filas seed). Mantenerla igual permite que alias y búsquedas
// matcheen contra la data existente.
function normalizeToken(value: null | string | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

const allergenInclude = { aliases: { orderBy: { id: "asc" as const } } };

type AllergenRow = NonNullable<Awaited<ReturnType<typeof getAllergenById>>>;

export function serializeAllergen(a: AllergenRow) {
  return {
    id: a.id,
    scientificName: a.scientificName,
    commonName: a.commonName,
    englishName: a.englishName,
    category: a.category,
    categoryEn: a.categoryEn,
    pollenType: a.pollenType,
    pollenTypeEn: a.pollenTypeEn,
    tags: a.tags,
    isActive: a.isActive,
    aliases: a.aliases.map((al: AllergenRow["aliases"][number]) => ({
      id: al.id,
      alias: al.alias,
      aliasType: al.aliasType,
    })),
  };
}

export async function getAllergenById(id: string) {
  return db.clinicalAllergen.findUnique({ where: { id }, include: allergenInclude });
}

export async function getAllergenOrThrow(id: string) {
  const allergen = await getAllergenById(id);
  if (!allergen) throw new DomainError("NOT_FOUND", "Alérgeno no encontrado");
  return allergen;
}

export async function listAllergens(opts?: {
  q?: string;
  category?: string;
  includeInactive?: boolean;
}) {
  const trimmed = opts?.q?.trim();
  const and: Record<string, unknown>[] = [];
  if (!opts?.includeInactive) and.push({ isActive: true });
  if (opts?.category) and.push({ category: opts.category });
  if (trimmed) {
    and.push({
      OR: [
        { commonName: { contains: trimmed, mode: "insensitive" as const } },
        { scientificName: { contains: trimmed, mode: "insensitive" as const } },
        { englishName: { contains: trimmed, mode: "insensitive" as const } },
        {
          normalizedCommonName: { contains: normalizeToken(trimmed), mode: "insensitive" as const },
        },
      ],
    });
  }
  return db.clinicalAllergen.findMany({
    where: and.length ? { AND: and } : undefined,
    include: allergenInclude,
    orderBy: [{ category: "asc" }, { commonName: "asc" }],
    take: 1000,
  });
}

// IDs siguen el patrón `alg_NNNN` del seed. Para altas manuales tomamos el
// siguiente correlativo. Carrera despreciable (alta admin, baja frecuencia).
async function nextAllergenId(): Promise<string> {
  const rows = await db.clinicalAllergen.findMany({
    where: { id: { startsWith: "alg_" } },
    select: { id: true },
  });
  let max = 0;
  for (const r of rows) {
    const n = Number.parseInt(r.id.slice(4), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `alg_${String(max + 1).padStart(4, "0")}`;
}

function buildAliasCreate(aliases: { alias: string; aliasType: string }[] | undefined) {
  if (!aliases?.length) return undefined;
  return {
    create: aliases.map((al) => ({
      id: crypto.randomUUID(),
      alias: al.alias.trim(),
      normalizedAlias: normalizeToken(al.alias),
      aliasType: al.aliasType,
    })),
  };
}

export async function createAllergen(input: CreateClinicalAllergenInput) {
  const id = await nextAllergenId();
  return db.clinicalAllergen.create({
    data: {
      id,
      scientificName: input.scientificName ?? null,
      commonName: input.commonName.trim(),
      englishName: input.englishName ?? null,
      category: input.category.trim(),
      categoryEn: input.categoryEn ?? null,
      pollenType: input.pollenType ?? null,
      pollenTypeEn: input.pollenTypeEn ?? null,
      normalizedCommonName: normalizeToken(input.commonName),
      normalizedScientificName: input.scientificName ? normalizeToken(input.scientificName) : null,
      tags: input.tags.map((t) => t.toLowerCase()),
      isActive: input.isActive,
      source: "manual",
      aliases: buildAliasCreate(input.aliases),
    },
    include: allergenInclude,
  });
}

export async function updateAllergen(input: UpdateClinicalAllergenInput) {
  const { id, aliases, ...rest } = input;
  await getAllergenOrThrow(id);

  const data: Record<string, unknown> = {};
  if (rest.scientificName !== undefined) {
    data.scientificName = rest.scientificName;
    data.normalizedScientificName = rest.scientificName
      ? normalizeToken(rest.scientificName)
      : null;
  }
  if (rest.commonName !== undefined) {
    data.commonName = rest.commonName.trim();
    data.normalizedCommonName = normalizeToken(rest.commonName);
  }
  if (rest.englishName !== undefined) data.englishName = rest.englishName;
  if (rest.category !== undefined) data.category = rest.category.trim();
  if (rest.categoryEn !== undefined) data.categoryEn = rest.categoryEn;
  if (rest.pollenType !== undefined) data.pollenType = rest.pollenType;
  if (rest.pollenTypeEn !== undefined) data.pollenTypeEn = rest.pollenTypeEn;
  if (rest.tags !== undefined) data.tags = rest.tags.map((t) => t.toLowerCase());
  if (rest.isActive !== undefined) data.isActive = rest.isActive;

  // Reemplazo total de aliases si vienen en el payload. Nested deleteMany+create
  // en el MISMO update → atómico: si el create falla (alias normalizado duplicado,
  // unique global) el delete hace rollback y los aliases previos se conservan.
  if (aliases !== undefined) {
    const created = buildAliasCreate(aliases);
    data.aliases = { deleteMany: {}, ...created };
  }

  return db.clinicalAllergen.update({ where: { id }, data, include: allergenInclude });
}

export async function deactivateAllergen(id: string) {
  await getAllergenOrThrow(id);
  return db.clinicalAllergen.update({
    where: { id },
    data: { isActive: false },
    include: allergenInclude,
  });
}
