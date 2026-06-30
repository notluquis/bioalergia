import { Alert, Breadcrumbs, Card, Skeleton } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import { ShopShell } from "@/components/ShopShell";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { CLP_FORMATTER } from "@/features/shop/lib/shop-config";
import { checkoutClient } from "@/lib/orpc-client";

// Prefer the opaque `token` (no email/PII in the URL); accept `email` for links
// issued before the token existed.
const searchSchema = z
  .object({ token: z.string().optional(), email: z.string().email().optional() })
  .refine((s) => Boolean(s.token) || Boolean(s.email));

function PedidoPage() {
  const { number } = Route.useParams();
  const { token, email } = Route.useSearch();

  const { data, isLoading, error } = useQuery({
    queryKey: ["order-status", number, token ?? email],
    queryFn: () =>
      checkoutClient.status({
        order_number: number,
        ...(token ? { token } : {}),
        ...(email ? { email } : {}),
      }),
    refetchInterval: (q) =>
      q.state.data?.data.status === "PAID" || q.state.data?.data.status === "CANCELLED"
        ? false
        : 5000,
  });

  return (
    <ShopShell>
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-12 sm:px-6">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item href="/tienda">Tienda</Breadcrumbs.Item>
          <Breadcrumbs.Item>Pedido {number}</Breadcrumbs.Item>
        </Breadcrumbs>

        <header className="space-y-3">
          <Eyebrow>Seguimiento</Eyebrow>
          <h1 className="font-display text-[2rem] text-foreground sm:text-[2.5rem]">
            Pedido {number}
          </h1>
        </header>

        {isLoading && <Skeleton className="h-32 w-full rounded-2xl" />}
        {error && (
          <Alert status="danger">
            <Alert.Content>
              <Alert.Description>No se pudo cargar el pedido.</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
        {data && (
          <Card className="rounded-2xl border-line bg-surface" variant="default">
            <Card.Header className="gap-2">
              <Eyebrow tone="muted">Estado del pedido</Eyebrow>
              <Card.Title className="font-display text-2xl text-foreground">
                {data.data.status}
              </Card.Title>
            </Card.Header>
            <Card.Content className="space-y-4 pb-6 text-sm">
              <div className="flex items-center justify-between border-line border-t pt-4">
                <span className="text-muted">Total</span>
                <strong className="text-base text-foreground">
                  {CLP_FORMATTER.format(data.data.total_clp)}
                </strong>
              </div>
              {data.data.dte_folio && (
                <div className="flex items-center justify-between">
                  <span className="text-muted">DTE folio ({data.data.dte_type})</span>
                  <span className="font-mono text-foreground">{data.data.dte_folio}</span>
                </div>
              )}
              {data.data.status === "PAID" && (
                <Alert status="success">
                  <Alert.Content>
                    <Alert.Description>
                      ¡Pago confirmado! Recibirás un email con la boleta.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              )}
              {data.data.status === "PENDING" && (
                <Alert status="accent">
                  <Alert.Content>
                    <Alert.Description>
                      Procesando pago — se actualiza automáticamente.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              )}
            </Card.Content>
          </Card>
        )}

        <Link className="text-muted text-sm hover:text-brand-blue hover:underline" to="/tienda">
          ← Seguir comprando
        </Link>
      </main>
    </ShopShell>
  );
}

export const Route = createFileRoute("/pedido/$number")({
  component: PedidoPage,
  validateSearch: searchSchema,
});
