import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { OrdersView } from "@/features/account/components/OrdersView";
import { accountKeys } from "@/features/account/queries";

function MiCuentaOrdersList() {
  const ordersQuery = useQuery(accountKeys.orders(20));

  return <OrdersView isLoading={ordersQuery.isLoading} orders={ordersQuery.data?.data} />;
}

export const Route = createFileRoute("/mi-cuenta/pedidos")({
  component: MiCuentaOrdersList,
});
