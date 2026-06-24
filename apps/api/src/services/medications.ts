import { db } from "@finanzas/db";

const DEFAULT_LIMIT = 15;

export type MedicationSearchHit = {
  activeIngredient: string | null;
  form: string | null;
  genericName: string | null;
  id: string;
  laboratory: string | null;
  name: string;
  presentation: string | null;
};

/**
 * Case-insensitive search over the medication catalog. Matches the query
 * against commercial name, generic name and active ingredient. Ordered by
 * name so the autocomplete list is stable.
 */
export async function searchMedications(
  q: string,
  limit = DEFAULT_LIMIT
): Promise<MedicationSearchHit[]> {
  const term = q.trim();

  if (term.length === 0) {
    return [];
  }

  const rows = await db.medication.findMany({
    orderBy: { name: "asc" },
    take: Math.min(Math.max(limit, 1), 50),
    where: {
      OR: [
        { name: { contains: term, mode: "insensitive" as const } },
        { genericName: { contains: term, mode: "insensitive" as const } },
        { activeIngredient: { contains: term, mode: "insensitive" as const } },
      ],
    },
  });

  return rows.map((row) => ({
    activeIngredient: row.activeIngredient,
    form: row.form,
    genericName: row.genericName,
    id: row.id,
    laboratory: row.laboratory,
    name: row.name,
    presentation: row.presentation,
  }));
}
