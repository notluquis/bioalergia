import type { CartContract } from "@finanzas/orpc-contracts/cart";
import { Breadcrumbs, Button, Card, NumberField, Skeleton } from "@heroui/react";
import type { InferContractRouterOutputs } from "@orpc/contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";

import { CLP_FORMATTER } from "@/features/shop/lib/shop-config";
import { shopKeys } from "@/features/shop/queries";
import { cartClient } from "@/lib/orpc-client";

type CartItem = InferContractRouterOutputs<CartContract>["get"]["data"]["items"][number];

function CarritoPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(shopKeys.cart());

  const updateMutation = useMutation({
    mutationFn: (input: { product_id: number; qty: number }) =>
      cartClient.updateItem(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: shopKeys.cart().queryKey }),
  });
  const removeMutation = useMutation({
    mutationFn: (product_id: number) => cartClient.removeItem({ product_id }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: shopKeys.cart().queryKey }),
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </main>
    );
  }

  const cart = data?.data;
  const empty = !cart || cart.items.length === 0;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <Breadcrumbs>
        <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/tienda">Tienda</Breadcrumbs.Item>
        <Breadcrumbs.Item>Mi carrito</Breadcrumbs.Item>
      </Breadcrumbs>
      <header>
        <h1 className="font-bold text-3xl">Mi carrito</h1>
        <Link className="text-foreground/60 text-sm hover:underline" to="/tienda">
          ← Seguir comprando
        </Link>
      </header>

      {empty ? (
        <Card variant="secondary">
          <Card.Content className="py-12 text-center">
            <p className="text-foreground/60">Tu carrito está vacío.</p>
            <Link className="mt-4 inline-block" to="/tienda">
              <Button variant="primary">Ir a la tienda</Button>
            </Link>
          </Card.Content>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {cart.items.map((item: CartItem) => (
              <Card key={item.id}>
                <Card.Content className="flex items-center gap-4 p-4">
                  <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-foreground/5">
                    {item.product.primary_image_url && (
                      <img
                        alt={item.product.name}
                        className="h-full w-full object-cover"
                        src={item.product.primary_image_url}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      className="font-semibold hover:underline"
                      params={{ slug: item.product.slug }}
                      to="/producto/$slug"
                    >
                      {item.product.name}
                    </Link>
                    <p className="text-foreground/60 text-xs">
                      {CLP_FORMATTER.format(item.unit_price_clp)} c/u
                    </p>
                  </div>
                  <NumberField
                    maxValue={Math.max(1, item.product.available_qty)}
                    minValue={0}
                    onChange={(v) =>
                      updateMutation.mutate({
                        product_id: item.product_id,
                        qty: Number(v),
                      })
                    }
                    value={item.qty}
                  >
                    <NumberField.Group>
                      <NumberField.DecrementButton />
                      <NumberField.Input className="w-12 text-center" />
                      <NumberField.IncrementButton />
                    </NumberField.Group>
                  </NumberField>
                  <div className="hidden text-right sm:block">
                    <p className="font-semibold">
                      {CLP_FORMATTER.format(item.unit_price_clp * item.qty)}
                    </p>
                  </div>
                  <Button
                    aria-label="Quitar del carrito"
                    isIconOnly
                    onPress={() => removeMutation.mutate(item.product_id)}
                    size="sm"
                    variant="danger"
                  >
                    <Trash2 size={14} />
                  </Button>
                </Card.Content>
              </Card>
            ))}
          </div>

          <Card>
            <Card.Header>
              <Card.Title>Resumen</Card.Title>
            </Card.Header>
            <Card.Content className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{CLP_FORMATTER.format(cart.subtotal_clp)}</span>
              </div>
              <div className="flex justify-between text-foreground/60 text-xs">
                <span>Envío</span>
                <span>Se calcula en checkout</span>
              </div>
              <div className="flex justify-between border-foreground/10 border-t pt-2 font-bold text-base">
                <span>Total estimado</span>
                <span>{CLP_FORMATTER.format(cart.total_clp)}</span>
              </div>
            </Card.Content>
            <Card.Footer>
              <Link className="block w-full" to="/checkout">
                <Button className="w-full" size="lg" variant="primary">
                  Ir al checkout
                </Button>
              </Link>
            </Card.Footer>
          </Card>
        </>
      )}
    </main>
  );
}

export const Route = createFileRoute("/carrito")({
  component: CarritoPage,
});
