import { Card, Skeleton } from "@heroui/react";
import { Link } from "@tanstack/react-router";

import type { AccountOrderSummary } from "@/features/account/lib/order-format";
import { formatItemCount, formatOrderDateShort } from "@/features/account/lib/order-format";
import { CLP_FORMATTER } from "@/features/shop/lib/shop-config";

// Presentational view for /mi-cuenta (dashboard). NO data fetching, NO Route.*
// hooks: takes the resolved customer name + recent orders + loading flag as
// plain props. The route wrapper (routes/mi-cuenta/index.tsx) wires the
// `me` + `orders(3)` queries to these props.

export type AccountOverviewViewProps = {
  /** Greeting name, already resolved from the session (`user.name ?? "Hola"`). */
  name: string;
  /** Most-recent order summaries, or undefined when not yet loaded. */
  recentOrders: AccountOrderSummary[] | undefined;
  isLoading: boolean;
};

export function AccountOverviewView({ name, recentOrders, isLoading }: AccountOverviewViewProps) {
  return (
    <div className="space-y-8">
      <header className="grid gap-2">
        <h1 className="font-display text-[2.5rem] leading-[1.04] text-foreground">Hola, {name}</h1>
        <p className="text-[1.0625rem] leading-[1.6] text-muted">
          Bienvenida/o a tu cuenta Bioalergia.
        </p>
      </header>

      <Card className="rounded-2xl border-line bg-surface">
        <Card.Header>
          <Card.Title className="font-display text-xl text-foreground">Últimos pedidos</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-3">
          {isLoading && <Skeleton className="h-24 w-full" />}
          {recentOrders?.length === 0 && (
            <p className="text-muted text-sm">
              Aún no tienes pedidos.{" "}
              <Link className="font-semibold text-brand-blue hover:underline" to="/tienda">
                Ir a la tienda
              </Link>
              .
            </p>
          )}
          {recentOrders?.map((order) => (
            <Link
              key={order.id}
              to="/mi-cuenta/pedidos/$number"
              params={{ number: order.number }}
              className="block rounded-xl border border-line bg-surface-2 p-4 transition hover:border-brand-amber"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground text-sm">Pedido {order.number}</p>
                  <p className="text-muted text-xs">
                    {formatOrderDateShort(order.created_at)} · {formatItemCount(order.item_count)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground text-sm">
                    {CLP_FORMATTER.format(order.total_clp)}
                  </p>
                  <p className="text-muted text-xs">{order.status}</p>
                </div>
              </div>
            </Link>
          ))}
          <Link
            className="font-semibold text-brand-blue text-sm hover:underline"
            to="/mi-cuenta/pedidos"
          >
            Ver todos los pedidos
          </Link>
        </Card.Content>
      </Card>
    </div>
  );
}
