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
    <div className="space-y-6">
      <header>
        <h1 className="font-bold text-3xl">Hola, {name}</h1>
        <p className="text-default-500 text-sm">Bienvenida/o a tu cuenta Bioalergia.</p>
      </header>

      <Card>
        <Card.Header>
          <Card.Title>Últimos pedidos</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-3">
          {isLoading && <Skeleton className="h-24 w-full" />}
          {recentOrders?.length === 0 && (
            <p className="text-default-500 text-sm">
              Aún no tienes pedidos.{" "}
              <Link className="underline" to="/tienda">
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
              className="block rounded border border-default-200 p-3 hover:bg-default-50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">Pedido {order.number}</p>
                  <p className="text-default-500 text-xs">
                    {formatOrderDateShort(order.created_at)} · {formatItemCount(order.item_count)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">{CLP_FORMATTER.format(order.total_clp)}</p>
                  <p className="text-default-500 text-xs">{order.status}</p>
                </div>
              </div>
            </Link>
          ))}
          <Link className="text-primary-700 text-sm underline" to="/mi-cuenta/pedidos">
            Ver todos los pedidos
          </Link>
        </Card.Content>
      </Card>
    </div>
  );
}
