type CategoryLike = {
  id: number;
  name: string;
  type: "INCOME" | "EXPENSE";
};

type TransactionLike = {
  category?: { id: number } | null;
  categoryId?: null | number;
};

export function buildCategoryFrequencyMap<TTransaction extends TransactionLike>(
  transactions: TTransaction[]
) {
  const frequencies = new Map<number, number>();

  for (const transaction of transactions) {
    const resolvedCategoryId = transaction.categoryId ?? transaction.category?.id ?? null;
    if (resolvedCategoryId == null) continue;
    frequencies.set(resolvedCategoryId, (frequencies.get(resolvedCategoryId) ?? 0) + 1);
  }

  return frequencies;
}

export function orderTransactionCategoriesByFrequency<TCategory extends CategoryLike>(
  categories: TCategory[],
  frequencies: Map<number, number>
) {
  return [...categories].sort((left, right) => {
    const frequencyDelta = (frequencies.get(right.id) ?? 0) - (frequencies.get(left.id) ?? 0);
    if (frequencyDelta !== 0) return frequencyDelta;

    const typeDelta = left.type.localeCompare(right.type);
    if (typeDelta !== 0) return typeDelta;

    const nameDelta = left.name.localeCompare(right.name, "es-CL", { sensitivity: "base" });
    if (nameDelta !== 0) return nameDelta;

    return left.id - right.id;
  });
}
