import { Alert, Breadcrumbs, Button, Card, Skeleton } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { ctaClass } from "@/components/ui/cta";
import { accountKeys } from "@/features/account/queries";
import { CLP_FORMATTER } from "@/features/shop/lib/shop-config";
import { shopKeys } from "@/features/shop/queries";
import { accountClient } from "@/lib/orpc-client";

function OrderDetailPage() {
  const { number } = Route.useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const orderQuery = useQuery(accountKeys.order(number));

  const repurchase = useMutation({
    mutationFn: () => accountClient.repurchase({ orderNumber: number }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: shopKeys.all });
      navigate({ to: "/carrito" });
    },
  });

  if (orderQuery.isLoading) return <Skeleton className="h-40 w-full" />;
  if (orderQuery.isError || !orderQuery.data) {
    return (
      <Alert status="danger">
        <Alert.Content>
          <Alert.Description>No se pudo cargar el pedido.</Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  const order = orderQuery.data.data;

  return (
    <div className="space-y-6">
      <Breadcrumbs>
        <Breadcrumbs.Item href="/mi-cuenta">Mi cuenta</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/mi-cuenta/pedidos">Pedidos</Breadcrumbs.Item>
        <Breadcrumbs.Item>{order.number}</Breadcrumbs.Item>
      </Breadcrumbs>

      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[2rem] leading-[1.05] text-foreground">
            Pedido {order.number}
          </h1>
          <p className="text-muted text-sm">
            {new Date(order.created_at).toLocaleString("es-CL")} · {order.status}
          </p>
        </div>
        <Button
          className={ctaClass("primary")}
          isDisabled={repurchase.isPending}
          onPress={() => repurchase.mutate()}
        >
          Volver a comprar
        </Button>
      </header>

      {repurchase.data && (
        <Alert status={repurchase.data.data.items_skipped_oos.length > 0 ? "warning" : "success"}>
          <Alert.Content>
            <Alert.Title>
              {repurchase.data.data.items_added} ítem(s) agregados al carrito
            </Alert.Title>
            {repurchase.data.data.items_skipped_oos.length > 0 && (
              <Alert.Description>
                Algunos productos no se pudieron agregar:{" "}
                {repurchase.data.data.items_skipped_oos
                  .map((item) => `${item.name} (${item.reason})`)
                  .join(", ")}
              </Alert.Description>
            )}
          </Alert.Content>
        </Alert>
      )}

      <Card className="rounded-2xl border-line bg-surface">
        <Card.Header>
          <Card.Title className="font-display text-xl text-foreground">Productos</Card.Title>
        </Card.Header>
        <Card.Content>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-line border-b text-left text-eyebrow">
                <th className="py-2 font-semibold">Producto</th>
                <th className="py-2 text-right font-semibold">Cant.</th>
                <th className="py-2 text-right font-semibold">Precio</th>
                <th className="py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => {
                const snap = (item.product_snapshot ?? {}) as { name?: string; sku?: string };
                return (
                  <tr key={item.id} className="border-line border-b text-foreground">
                    <td className="py-2">
                      {snap.name ?? `Producto #${item.product_id}`}
                      {snap.sku && <span className="ml-1 text-muted text-xs">({snap.sku})</span>}
                    </td>
                    <td className="py-2 text-right">{item.qty}</td>
                    <td className="py-2 text-right">{CLP_FORMATTER.format(item.unit_price_clp)}</td>
                    <td className="py-2 text-right">{CLP_FORMATTER.format(item.line_total_clp)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="py-2 text-right text-muted">
                  Subtotal
                </td>
                <td className="py-2 text-right text-foreground">
                  {CLP_FORMATTER.format(order.subtotal_clp)}
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="py-2 text-right text-muted">
                  Envío
                </td>
                <td className="py-2 text-right text-foreground">
                  {CLP_FORMATTER.format(order.shipping_clp)}
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="py-2 text-right font-semibold text-foreground">
                  Total
                </td>
                <td className="py-2 text-right font-semibold text-foreground">
                  {CLP_FORMATTER.format(order.total_clp)}
                </td>
              </tr>
            </tfoot>
          </table>
        </Card.Content>
      </Card>

      {order.dte_folio && (
        <Card className="rounded-2xl border-line bg-surface">
          <Card.Content className="p-4 text-foreground text-sm">
            <p>
              <strong>Documento:</strong> {order.dte_type} N° {order.dte_folio}
            </p>
          </Card.Content>
        </Card>
      )}

      <Link
        className="font-semibold text-brand-blue text-sm hover:underline"
        to="/mi-cuenta/pedidos"
      >
        ← Volver a mis pedidos
      </Link>
    </div>
  );
}

export const Route = createFileRoute("/mi-cuenta/pedidos/$number")({
  component: OrderDetailPage,
});
