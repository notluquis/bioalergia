import { Button, Card, Skeleton } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { accountKeys } from "@/features/account/queries";
import { siteAuthClient } from "@/lib/orpc-client";

type NavItem = { to: string; label: string };

const navItems: NavItem[] = [
  { to: "/mi-cuenta", label: "Resumen" },
  { to: "/mi-cuenta/pedidos", label: "Pedidos" },
  { to: "/mi-cuenta/direcciones", label: "Direcciones" },
  { to: "/mi-cuenta/seguridad", label: "Seguridad" },
];

function MiCuentaLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const meQuery = useQuery(accountKeys.me());

  const logoutMutation = useMutation({
    mutationFn: () => siteAuthClient.logout(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountKeys.all });
      navigate({ to: "/" });
    },
  });

  useEffect(() => {
    if (
      meQuery.isSuccess &&
      !meQuery.data.user &&
      !location.pathname.startsWith("/mi-cuenta/auth/")
    ) {
      navigate({ to: "/login", replace: true });
    }
  }, [meQuery.isSuccess, meQuery.data, location.pathname, navigate]);

  if (meQuery.isLoading) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  // Auth callback handles its own loading state without the layout shell —
  // render the Outlet directly so the redirect to /mi-cuenta isn't blocked
  // by the "no user" guard above.
  if (location.pathname.startsWith("/mi-cuenta/auth/")) {
    return <Outlet />;
  }

  if (!meQuery.data?.user) {
    return null; // redirect in-flight
  }

  const user = meQuery.data.user;

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-[220px_1fr]">
      <aside className="space-y-2">
        <Card>
          <Card.Content className="space-y-1 p-4">
            <p className="font-semibold text-sm">{user.name ?? "Cliente"}</p>
            <p className="break-all text-default-500 text-xs">{user.email}</p>
          </Card.Content>
        </Card>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active =
              item.to === "/mi-cuenta"
                ? location.pathname === "/mi-cuenta"
                : location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-primary-100 font-semibold text-primary-700"
                    : "text-default-700 hover:bg-default-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <Button
            isDisabled={logoutMutation.isPending}
            onPress={() => logoutMutation.mutate()}
            variant="ghost"
          >
            Cerrar sesión
          </Button>
        </nav>
      </aside>
      <section>
        <Outlet />
      </section>
    </main>
  );
}

export const Route = createFileRoute("/mi-cuenta")({
  component: MiCuentaLayout,
});
