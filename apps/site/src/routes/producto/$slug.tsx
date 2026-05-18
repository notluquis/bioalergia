import { Alert, Button, Card, Chip, NumberField, Spinner } from "@heroui/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart } from "lucide-react";
import { useState } from "react";

import { cartClient } from "@/lib/orpc-client";
import { shopKeys } from "@/features/shop/queries";

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function ProductDetailPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [qty, setQty] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery(shopKeys.product(slug));

  const addMutation = useMutation({
    mutationFn: (input: { product_id: number; qty: number }) =>
      cartClient.addItem(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: shopKeys.cart().queryKey });
      void navigate({ to: "/carrito" });
    },
    onError: (e) => setFeedback(e instanceof Error ? e.message : "Error"),
  });

  if (isLoading) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
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

  const product = data.data;
  const primary =
    product.images?.find((i) => i.is_primary) ?? product.images?.[0] ?? null;
  const outOfStock = product.available_qty <= 0;
  const maxQty = Math.min(99, Math.max(0, product.available_qty - product.safety_stock));

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Link className="text-foreground/60 text-sm hover:underline" to="/tienda">
        ← Tienda
      </Link>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card>
          <Card.Content className="p-0">
            <div className="aspect-square overflow-hidden rounded-t-[18px] bg-foreground/5">
              {primary ? (
                <img
                  alt={primary.alt ?? product.name}
                  className="h-full w-full object-cover"
                  src={primary.cdn_url}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-foreground/30">
                  Sin imagen
                </div>
              )}
            </div>
          </Card.Content>
        </Card>

        <div className="space-y-5">
          {product.brand && (
            <p className="text-foreground/60 text-sm uppercase">{product.brand}</p>
          )}
          <h1 className="font-bold text-2xl sm:text-3xl">{product.name}</h1>

          <div className="flex items-baseline gap-3">
            <span className="font-bold text-3xl">{CLP.format(product.price_clp)}</span>
            {product.compare_at_price_clp &&
              product.compare_at_price_clp > product.price_clp && (
                <span className="text-foreground/50 line-through">
                  {CLP.format(product.compare_at_price_clp)}
                </span>
              )}
          </div>

          {product.short_description && (
            <p className="text-foreground/80">{product.short_description}</p>
          )}

          {product.description && (
            <Card variant="secondary">
              <Card.Content className="whitespace-pre-line text-sm">
                {product.description}
              </Card.Content>
            </Card>
          )}

          {feedback && (
            <Alert status="danger">
              <Alert.Content>
                <Alert.Description>{feedback}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          {outOfStock ? (
            <Chip variant="soft">Agotado</Chip>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <NumberField
                isDisabled={addMutation.isPending}
                maxValue={maxQty}
                minValue={1}
                onChange={(v) => setQty(Number(v))}
                value={qty}
              >
                <NumberField.Label className="sr-only">Cantidad</NumberField.Label>
                <NumberField.Group>
                  <NumberField.DecrementButton />
                  <NumberField.Input className="w-16 text-center" />
                  <NumberField.IncrementButton />
                </NumberField.Group>
              </NumberField>

              <Button
                className="flex-1"
                isDisabled={addMutation.isPending}
                onPress={() =>
                  addMutation.mutate({ product_id: product.id, qty })
                }
                size="lg"
                variant="primary"
              >
                <ShoppingCart size={18} />
                {addMutation.isPending ? "Agregando…" : "Agregar al carrito"}
              </Button>
            </div>
          )}

          <p className="text-foreground/50 text-xs">
            SKU: <span className="font-mono">{product.sku}</span>
          </p>
        </div>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/producto/$slug")({
  component: ProductDetailPage,
});
