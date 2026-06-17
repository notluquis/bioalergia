import { Alert, Skeleton } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { ProductDetailView } from "@/features/shop/components/ProductDetailView";
import { useShopConfig } from "@/features/shop/lib/shop-config";
import { shopKeys } from "@/features/shop/queries";
import { cartClient, catalogClient } from "@/lib/orpc-client";

function ProductDetailPage() {
  const { slug } = Route.useParams();
  const queryClient = useQueryClient();
  const [qty, setQty] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const { lowStockThreshold } = useShopConfig();
  const { data, isLoading, error } = useQuery(shopKeys.product(slug));
  const productId = data?.data.id;
  const reviewsAggregateQ = useQuery({
    queryKey: ["shop", "reviews", productId],
    queryFn: () => {
      if (typeof productId !== "number") throw new Error("productId requerido");
      return catalogClient.listReviews({ id: productId });
    },
    enabled: typeof productId === "number",
    staleTime: 1000 * 60 * 5,
  });

  const addMutation = useMutation({
    mutationFn: (input: { product_id: number; qty: number }) => cartClient.addItem(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: shopKeys.cart().queryKey });
      setAdded(true);
      setFeedback(null);
    },
    onError: (e) => setFeedback(e instanceof Error ? e.message : "Error"),
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-12 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </main>
    );
  }
  if (error || !data) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Alert status="danger">
          <Alert.Content>
            <Alert.Description>Producto no encontrado.</Alert.Description>
          </Alert.Content>
        </Alert>
        <Link to="/tienda">← Volver a la tienda</Link>
      </main>
    );
  }

  return (
    <ProductDetailView
      added={added}
      feedback={feedback}
      isAdding={addMutation.isPending}
      lowStockThreshold={lowStockThreshold}
      onAddToCart={(addQty) => addMutation.mutate({ product_id: data.data.id, qty: addQty })}
      onQtyChange={setQty}
      product={data.data}
      qty={qty}
      reviewsAggregate={reviewsAggregateQ.data?.aggregate}
    />
  );
}

export const Route = createFileRoute("/producto/$slug")({
  component: ProductDetailPage,
  head: ({ params }) => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/producto/${params.slug}`;
    const titleHuman = params.slug
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
    const title = `${titleHuman} · Tienda Bioalergia`;
    return {
      meta: [
        { title },
        { name: "description", content: `${titleHuman} en Tienda Bioalergia.` },
        { property: "og:title", content: title },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        { name: "twitter:title", content: title },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});
