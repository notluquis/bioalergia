import { useQuery } from "@tanstack/react-query";

import { ProductCard } from "@/features/shop/components/ProductCard";
import { relatedProducts } from "@/features/shop/lib/gallery";
import { catalogClient } from "@/lib/orpc-client";

export function RelatedProducts({
  categorySlug,
  excludeId,
}: {
  categorySlug: string;
  excludeId: number;
}) {
  const { data } = useQuery({
    queryKey: ["shop", "related", categorySlug],
    queryFn: () => catalogClient.list({ category_slug: categorySlug, limit: 5 }),
    staleTime: 1000 * 60 * 5,
  });

  const items = relatedProducts(data?.data ?? [], excludeId);
  if (items.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl text-foreground sm:text-[1.75rem]">
        También te puede interesar
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
