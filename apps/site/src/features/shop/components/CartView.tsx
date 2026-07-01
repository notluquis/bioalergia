import type { CartContract } from "@finanzas/orpc-contracts/cart";
import { Alert, Breadcrumbs, Button, Card, Chip, Label, NumberField, Skeleton } from "@heroui/react";
import type { InferContractRouterOutputs } from "@orpc/contract";
import { Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";

import { Eyebrow } from "@/components/ui/Eyebrow";
import { ctaClass } from "@/components/ui/cta";
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
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-12 sm:px-6">
        <Skeleton className="h-6 w-32 rounded-full" />
        <Skeleton className="h-10 w-48 rounded-full" />
        <Skeleton className="h-24 w-full rounded-3xl" />
        <Skeleton className="h-24 w-full rounded-3xl" />
      </main>
    );
  }

  const empty = !cart || cart.items.length === 0;
  // Any line whose snapshot stock dropped to 0 since it was added — surfaced as a
  // banner above the total so the user fixes it before hitting checkout.
  const hasOutOfStock = (cart?.items ?? []).some((i) => i.product.available_qty <= 0);

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-12 sm:px-6">
      <Breadcrumbs>
        <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/tienda">Tienda</Breadcrumbs.Item>
        <Breadcrumbs.Item>Mi carrito</Breadcrumbs.Item>
      </Breadcrumbs>
      <header className="space-y-3">
        <Eyebrow>Tu compra</Eyebrow>
        <h1 className="font-display text-[2rem] text-foreground sm:text-[2.5rem]">Mi carrito</h1>
        <Link className="text-muted text-sm hover:text-brand-blue hover:underline" to="/tienda">
          ← Seguir comprando
        </Link>
      </header>

      {empty ? (
        <Card className="rounded-3xl border-line bg-surface" variant="default">
          <Card.Content className="py-16 text-center">
            <p className="text-muted">Tu carrito está vacío.</p>
            <Link className={ctaClass("primary", "mt-6")} to="/tienda">
              Ir a la tienda
            </Link>
          </Card.Content>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {cart.items.map((item: CartItem) => {
              const availableQty = item.product.available_qty;
              const lineOutOfStock = availableQty <= 0;
              const lineLowStock = availableQty > 0 && availableQty <= 5;
              return (
              <Card className="rounded-3xl border-line bg-surface" key={item.id} variant="default">
                <Card.Content className="flex items-center gap-4 p-5">
                  <div className="flex-shrink-0 overflow-hidden rounded-2xl bg-surface-2 size-20">
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
                      className="font-semibold text-foreground hover:text-brand-blue hover:underline"
                      params={{ slug: item.product.slug }}
                      to="/producto/$slug"
                    >
                      {item.product.name}
                    </Link>
                    <p className="text-muted text-xs">
                      {CLP_FORMATTER.format(item.unit_price_clp)} c/u
                    </p>
                    {lineOutOfStock && (
                      <Chip className="mt-1" color="danger" size="sm" variant="soft">
                        Agotado
                      </Chip>
                    )}
                    {lineLowStock && (
                      <Chip className="mt-1" color="warning" size="sm" variant="soft">
                        Pocas unidades
                      </Chip>
                    )}
                  </div>
                  <NumberField
                    maxValue={lineOutOfStock ? item.qty : Math.max(1, availableQty)}
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
                    <p className="font-semibold text-foreground">
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
              );
            })}
          </div>

          {hasOutOfStock && (
            <Alert status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>
                  Hay productos agotados en tu carrito. Quítalos o reduce la cantidad para poder
                  continuar al checkout.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          <Card className="rounded-3xl border-line bg-surface" variant="default">
            <Card.Header className="gap-1">
              <Eyebrow tone="muted">Resumen</Eyebrow>
              <Card.Title className="font-display text-2xl text-foreground">
                Resumen del carrito
              </Card.Title>
            </Card.Header>
            <Card.Content className="space-y-3 text-sm">
              <div className="flex justify-between text-foreground">
                <span className="text-muted">Subtotal</span>
                <span>{CLP_FORMATTER.format(cart.subtotal_clp)}</span>
              </div>
              <div className="flex justify-between border-line border-t pt-3 font-bold text-base text-foreground">
                <span>Subtotal</span>
                <span>{CLP_FORMATTER.format(cart.total_clp)}</span>
              </div>
              <p className="text-muted text-xs">El envío se calcula en el checkout.</p>
            </Card.Content>
            <Card.Footer>
              <Link className={ctaClass("primary", "w-full")} to="/checkout">
                Ir al checkout
              </Link>
            </Card.Footer>
          </Card>
        </>
      )}
    </main>
  );
}
