import { Alert, Button, Card, NumberField, Spinner } from "@heroui/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";

import { cartClient } from "@/lib/orpc-client";
import { shopKeys } from "@/features/shop/queries";

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

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
      <main className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </main>
    );
  }

  const cart = data?.data;
  const empty = !cart || cart.items.length === 0;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <Link className="text-foreground/60 text-sm hover:underline" to="/tienda">
          ← Seguir comprando
        </Link>
        <h1 className="mt-2 font-bold text-3xl">Mi carrito</h1>
      </header>

      {empty ? (
        <Card variant="secondary">
          <Card.Content className="py-12 text-center">
            <p className="text-foreground/60">Tu carrito está vacío.</p>
            <Button as={Link} className="mt-4" to="/tienda" variant="primary">
              Ir a la tienda
            </Button>
          </Card.Content>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {cart.items.map((item) => (
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
                      {CLP.format(item.unit_price_clp)} c/u
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
                      {CLP.format(item.unit_price_clp * item.qty)}
                    </p>
                  </div>
                  <Button
                    onPress={() => removeMutation.mutate(item.product_id)}
                    size="sm"
                    variant="danger-soft"
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
                <span>{CLP.format(cart.subtotal_clp)}</span>
              </div>
              <div className="flex justify-between text-foreground/60 text-xs">
                <span>Envío</span>
                <span>Se calcula en checkout</span>
              </div>
              <div className="flex justify-between border-foreground/10 border-t pt-2 font-bold text-base">
                <span>Total estimado</span>
                <span>{CLP.format(cart.total_clp)}</span>
              </div>
            </Card.Content>
            <Card.Footer>
              <Button as={Link} className="w-full" size="lg" to="/checkout" variant="primary">
                Ir al checkout
              </Button>
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
