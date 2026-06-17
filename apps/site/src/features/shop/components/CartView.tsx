import type { CartContract } from "@finanzas/orpc-contracts/cart";
import { Breadcrumbs, Button, Card, Label, NumberField, Skeleton } from "@heroui/react";
import type { InferContractRouterOutputs } from "@orpc/contract";
import { Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";

import { lineTotalClp } from "@/features/shop/lib/cart-math";
import { CLP_FORMATTER } from "@/features/shop/lib/shop-config";

// Presentational view for /carrito. NO data fetching, NO Route.* hooks: takes
// the cart + loading flag + mutation callbacks as plain props. The route wrapper
// (routes/carrito.tsx) wires the query + mutations to these props.

type Cart = InferContractRouterOutputs<CartContract>["get"]["data"];
type CartItem = Cart["items"][number];

export type CartViewProps = {
  /** The cart, or undefined when not yet loaded / unavailable. */
  cart: Cart | undefined;
  isLoading: boolean;
  /** Called when a line quantity changes (0 = remove via 0-qty update upstream). */
  onUpdateQty: (input: { product_id: number; qty: number }) => void;
  /** Called when the trash button removes a line. */
  onRemove: (productId: number) => void;
};

export function CartView({ cart, isLoading, onUpdateQty, onRemove }: CartViewProps) {
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
                  <div className="flex-shrink-0 overflow-hidden rounded-lg bg-foreground/5 size-20">
                    {item.product.primary_image_url && (
                      <img
                        alt={item.product.name}
                        className="object-cover size-full"
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
                      onUpdateQty({
                        product_id: item.product_id,
                        qty: Number(v),
                      })
                    }
                    value={item.qty}
                  >
                    <Label className="sr-only">{`Cantidad de ${item.product.name}`}</Label>
                    <NumberField.Group>
                      <NumberField.DecrementButton />
                      <NumberField.Input className="w-12 text-center" />
                      <NumberField.IncrementButton />
                    </NumberField.Group>
                  </NumberField>
                  <div className="hidden text-right sm:block">
                    <p className="font-semibold">
                      {CLP_FORMATTER.format(lineTotalClp(item.unit_price_clp, item.qty))}
                    </p>
                  </div>
                  <Button
                    aria-label="Quitar del carrito"
                    isIconOnly
                    onPress={() => onRemove(item.product_id)}
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
