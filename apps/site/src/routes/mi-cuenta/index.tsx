import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AccountOverviewView } from "@/features/account/components/AccountOverviewView";
import { accountKeys } from "@/features/account/queries";

function MiCuentaDashboard() {
  const meQuery = useQuery(accountKeys.me());
  const ordersQuery = useQuery(accountKeys.orders(3));

  const name = meQuery.data?.user?.name ?? "Hola";

  return (
    <AccountOverviewView
      isLoading={ordersQuery.isLoading}
      name={name}
      recentOrders={ordersQuery.data?.data}
    />
  );
}

export const Route = createFileRoute("/mi-cuenta/")({
  component: MiCuentaDashboard,
});
