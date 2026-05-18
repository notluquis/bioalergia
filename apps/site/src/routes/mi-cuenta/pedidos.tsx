import { Card, Skeleton } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { accountKeys } from "@/features/account/queries";
import { CLP_FORMATTER } from "@/features/shop/lib/shop-config";

function MiCuentaOrdersList() {
  const ordersQuery = useQuery(accountKeys.orders(20));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-bold text-2xl">Mis pedidos</h1>
      </header>
      {ordersQuery.isLoading && <Skeleton className="h-32 w-full" />}
      {ordersQuery.data?.data.length === 0 && (
        <Card>
          <Card.Content>
            <p className="text-default-500 text-sm">
              Aún no tienes pedidos.{" "}
              <Link className="underline" to="/tienda">
                Ir a la tienda
              </Link>
              .
            </p>
          </Card.Content>
        </Card>
      )}
      <div className="space-y-2">
        {ordersQuery.data?.data.map((order) => (
          <Link
            key={order.id}
            to="/mi-cuenta/pedidos/$number"
            params={{ number: order.number }}
            className="block"
          >
            <Card>
              <Card.Content className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">{order.number}</p>
                  <p className="text-default-500 text-xs">
                    {new Date(order.created_at).toLocaleString("es-CL")} ·{" "}
                    {order.item_count} ítem(s) · {order.channel}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {CLP_FORMATTER.format(order.total_clp)}
                  </p>
                  <p className="text-default-500 text-xs">{order.status}</p>
                </div>
              </Card.Content>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/mi-cuenta/pedidos")({
  component: MiCuentaOrdersList,
});
