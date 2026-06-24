import { Alert, Breadcrumbs, Card, Skeleton } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import { CLP_FORMATTER } from "@/features/shop/lib/shop-config";
import { checkoutClient } from "@/lib/orpc-client";

const searchSchema = z.object({ email: z.string().email() });

function PedidoPage() {
  const { number } = Route.useParams();
  const { email } = Route.useSearch();

  const { data, isLoading, error } = useQuery({
    queryKey: ["order-status", number, email],
    queryFn: () => checkoutClient.status({ order_number: number, email }),
    refetchInterval: (q) =>
      q.state.data?.data.status === "PAID" || q.state.data?.data.status === "CANCELLED"
        ? false
        : 5000,
  });

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Breadcrumbs>
        <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/tienda">Tienda</Breadcrumbs.Item>
        <Breadcrumbs.Item>Pedido {number}</Breadcrumbs.Item>
      </Breadcrumbs>

      <header>
        <h1 className="font-bold text-3xl">Pedido {number}</h1>
      </header>

      {isLoading && <Skeleton className="h-32 w-full" />}
      {error && (
        <Alert status="danger">
          <Alert.Content>
            <Alert.Description>No se pudo cargar el pedido.</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      {data && (
        <Card>
          <Card.Header>
            <Card.Title>Estado: {data.data.status}</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-2 text-sm">
            <p>
              Total: <strong>{CLP_FORMATTER.format(data.data.total_clp)}</strong>
            </p>
            {data.data.dte_folio && (
              <p>
                DTE folio: <span className="font-mono">{data.data.dte_folio}</span> (
                {data.data.dte_type})
              </p>
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

      <Link className="text-sm text-foreground/60 hover:underline" to="/tienda">
        ← Seguir comprando
      </Link>
    </main>
  );
}

export const Route = createFileRoute("/pedido/$number")({
  component: PedidoPage,
  validateSearch: searchSchema,
});
