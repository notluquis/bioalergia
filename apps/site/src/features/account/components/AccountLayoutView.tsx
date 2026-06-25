import { Button, Card } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

// Presentational shell for the /mi-cuenta layout: sidebar (user card + nav +
// logout) wrapping the routed section. NO data fetching, NO Route.* hooks and —
// critically — NO auth-redirect logic: the loading skeleton, the auth-callback
// passthrough, and the "no user → redirect" guard all stay in the route wrapper
// (routes/mi-cuenta.tsx). This View is only mounted once the user is known.

type NavItem = { to: string; label: string };

const navItems: NavItem[] = [
  { to: "/mi-cuenta", label: "Resumen" },
  { to: "/mi-cuenta/pedidos", label: "Pedidos" },
  { to: "/mi-cuenta/direcciones", label: "Direcciones" },
  { to: "/mi-cuenta/seguridad", label: "Seguridad" },
];

export type AccountLayoutUser = {
  name: string | null;
  email: string;
};

export type AccountLayoutViewProps = {
  user: AccountLayoutUser;
  /** Current pathname, used to highlight the active nav link. */
  activePath: string;
  isLoggingOut: boolean;
  onLogout: () => void;
  /** The routed section content (the route's <Outlet />). */
  children: ReactNode;
};

export function AccountLayoutView({
  user,
  activePath,
  isLoggingOut,
  onLogout,
  children,
}: AccountLayoutViewProps) {
  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[240px_1fr]">
      <aside className="space-y-4">
        <Card className="rounded-2xl border-line bg-surface">
          <Card.Content className="space-y-1 p-4">
            <p className="font-display text-lg text-foreground">{user.name ?? "Cliente"}</p>
            <p className="break-all text-muted text-xs">{user.email}</p>
          </Card.Content>
        </Card>
        <nav className="flex flex-col gap-1 border-line border-t pt-3">
          {navItems.map((item) => {
            const active =
              item.to === "/mi-cuenta" ? activePath === "/mi-cuenta" : activePath === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-chip font-semibold text-brand-blue"
                    : "text-foreground hover:bg-surface-2"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <Button
            className="mt-2 justify-start text-muted"
            isDisabled={isLoggingOut}
            onPress={onLogout}
            variant="ghost"
          >
            Cerrar sesión
          </Button>
        </nav>
      </aside>
      <section>{children}</section>
    </main>
  );
}
