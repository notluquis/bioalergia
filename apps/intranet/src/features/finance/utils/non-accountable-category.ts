export const NON_ACCOUNTABLE_CATEGORY_ICON = "NON_ACCOUNTABLE";
const NON_ACCOUNTABLE_CATEGORY_NAME_NORMALIZED = "no contabilizable";

const normalizeCategoryName = (value: null | string | undefined) =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function isNonAccountableCategory(
  category: null | undefined | { icon?: null | string; name: string },
) {
  if (!category) return false;
  if (category.icon === NON_ACCOUNTABLE_CATEGORY_ICON) return true;
  return normalizeCategoryName(category.name) === NON_ACCOUNTABLE_CATEGORY_NAME_NORMALIZED;
}
