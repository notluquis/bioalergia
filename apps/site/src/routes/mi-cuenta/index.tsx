import { Card, Skeleton } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { accountKeys } from "@/features/account/queries";
import { CLP_FORMATTER } from "@/features/shop/lib/shop-config";

function MiCuentaDashboard() {
  const meQuery = useQuery(accountKeys.me());
  const ordersQuery = useQuery(accountKeys.orders(3));

  const name = meQuery.data?.user?.name ?? "Hola";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-bold text-3xl">Hola, {name}</h1>
        <p className="text-default-500 text-sm">
          Bienvenida/o a tu cuenta Bioalergia.
        </p>
      </header>

      <Card>
        <Card.Header>
          <Card.Title>Últimos pedidos</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-3">
          {ordersQuery.isLoading && <Skeleton className="h-24 w-full" />}
          {ordersQuery.data?.data.length === 0 && (
            <p className="text-default-500 text-sm">
              Aún no tienes pedidos.{" "}
              <Link className="underline" to="/tienda">
                Ir a la tienda
              </Link>
              .
            </p>
          )}
          {ordersQuery.data?.data.map((order) => (
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
                    {new Date(order.created_at).toLocaleDateString("es-CL")} ·{" "}
                    {order.item_count} ítem(s)
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">
                    {CLP_FORMATTER.format(order.total_clp)}
                  </p>
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

export const Route = createFileRoute("/mi-cuenta/")({
  component: MiCuentaDashboard,
});
