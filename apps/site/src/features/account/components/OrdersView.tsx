import { Card, Skeleton } from "@heroui/react";
import { Link } from "@tanstack/react-router";

import type { AccountOrderSummary } from "@/features/account/lib/order-format";
import { formatItemCount, formatOrderDateTime } from "@/features/account/lib/order-format";
import { CLP_FORMATTER } from "@/features/shop/lib/shop-config";

// Presentational view for /mi-cuenta/pedidos. NO data fetching, NO Route.*
// hooks: takes the orders + loading flag as plain props. The route wrapper
// (routes/mi-cuenta/pedidos.tsx) wires the query to these props.

export type OrdersViewProps = {
  /** Order summaries, or undefined when not yet loaded. */
  orders: AccountOrderSummary[] | undefined;
  isLoading: boolean;
};

export function OrdersView({ orders, isLoading }: OrdersViewProps) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[2rem] leading-[1.05] text-foreground">Mis pedidos</h1>
      </header>
      {isLoading && <Skeleton className="h-32 w-full" />}
      {orders?.length === 0 && (
        <Card className="rounded-2xl border-line bg-surface">
          <Card.Content>
            <p className="text-muted text-sm">
              Aún no tienes pedidos.{" "}
              <Link className="font-semibold text-brand-blue hover:underline" to="/tienda">
                Ir a la tienda
              </Link>
              .
            </p>
          </Card.Content>
        </Card>
      )}
      <div className="space-y-3">
        {orders?.map((order) => (
          <Link
            key={order.id}
            to="/mi-cuenta/pedidos/$number"
            params={{ number: order.number }}
            className="block"
          >
            <Card className="rounded-2xl border-line bg-surface transition hover:border-brand-amber">
              <Card.Content className="flex items-center justify-between p-4">
                <div>
                  <p className="font-display text-lg text-foreground">{order.number}</p>
                  <p className="text-muted text-xs">
                    {formatOrderDateTime(order.created_at)} · {formatItemCount(order.item_count)} ·{" "}
                    {order.channel}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">
                    {CLP_FORMATTER.format(order.total_clp)}
                  </p>
                  <p className="text-muted text-xs">{order.status}</p>
                </div>
              </Card.Content>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
