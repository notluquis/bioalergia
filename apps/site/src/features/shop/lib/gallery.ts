// Pure product-gallery + related-products list logic, extracted from
// features/shop/components/{ProductGallery,RelatedProducts}.tsx so it is
// unit-testable without a React renderer. Behavior is byte-identical to the
// original inline expressions.

/** Minimal structural shape gallery sorting depends on. */
export type PrimaryFlagged = { is_primary: boolean };

/**
 * Returns a new array of images with primary images first (stable for the rest).
 * Mirrors `[...images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))`,
 * returning an empty array when there are no images.
 */
export function sortGalleryImages<T extends PrimaryFlagged>(images: readonly T[]): T[] {
  return images.length
    ? [...images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    : [];
}

/** Minimal structural shape related-product filtering depends on. */
export type WithId = { id: number };

/**
 * The first up-to-four related products, excluding the product with `excludeId`.
 * Mirrors `(items ?? []).filter((p) => p.id !== excludeId).slice(0, 4)`.
 */
export function relatedProducts<T extends WithId>(items: readonly T[], excludeId: number): T[] {
  return items.filter((p) => p.id !== excludeId).slice(0, 4);
}
