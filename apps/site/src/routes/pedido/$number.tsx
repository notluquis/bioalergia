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

type OrderStatus = "PENDING" | "PAID" | "FULFILLED" | "DELIVERED" | "CANCELLED" | "REFUNDED";

// Friendly Spanish label + short explanation for each raw status enum. Keeps the
// buyer from seeing the raw uppercase enum.
const STATUS_META: Record<OrderStatus, { label: string; help: string }> = {
  PENDING: { label: "Esperando pago", help: "Esperando confirmación de pago" },
  PAID: { label: "Pago confirmado", help: "Pago confirmado, preparando tu pedido" },
  FULFILLED: { label: "Despachado", help: "Despachado" },
  DELIVERED: { label: "Entregado", help: "Entregado" },
  CANCELLED: { label: "Cancelado", help: "Cancelado" },
  REFUNDED: { label: "Reembolsado", help: "Reembolsado" },
};

// Terminal states: once here the order won't change, so stop polling.
const TERMINAL_STATUSES = new Set<OrderStatus>([
  "PAID",
  "FULFILLED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
]);

// Chilexpress lets the buyer paste the OT number into its public tracking portal.
const CHILEXPRESS_TRACKING_URL = "https://www.chilexpress.cl/seguimiento";

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
    refetchInterval: (q) => {
      const status = q.state.data?.data.status;
      return status && TERMINAL_STATUSES.has(status) ? false : 5000;
    },
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

        {isLoading && (
          <output aria-busy="true" aria-label="Cargando estado del pedido" className="block">
            <Skeleton className="h-32 w-full rounded-2xl" />
          </output>
        )}
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
                {STATUS_META[data.data.status].label}
              </Card.Title>
              <p className="text-muted text-sm">{STATUS_META[data.data.status].help}</p>
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
              {data.data.cx_ot_number && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Seguimiento Chilexpress</span>
                  <a
                    className="font-mono text-brand-blue hover:underline"
                    href={CHILEXPRESS_TRACKING_URL}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {data.data.cx_ot_number}
                  </a>
                </div>
              )}
              {data.data.dte_pdf_url && (
                <a
                  className="inline-flex font-semibold text-brand-blue hover:underline"
                  href={data.data.dte_pdf_url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Descargar boleta/factura
                </a>
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
