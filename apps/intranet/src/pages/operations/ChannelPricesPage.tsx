import { Button, Card, Input, Label, Skeleton, TextField } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { catalogORPCClient } from "@/features/catalog/orpc";

const CHANNELS = ["WEB", "MERCADO_LIBRE", "UBER_EATS", "PEDIDOS_YA", "RAPPI"] as const;
type Channel = (typeof CHANNELS)[number];

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export function ChannelPricesPage() {
  const queryClient = useQueryClient();
  const [productId, setProductId] = useState<number | null>(null);

  const productsQ = useQuery({
    queryKey: ["catalog", "products-all"],
    queryFn: () => catalogORPCClient.list({ limit: 100, include_inactive: true }),
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-bold text-3xl">Precios por canal</h1>
        <p className="text-foreground/60 text-sm">
          Configura precios distintos por canal de venta. Si un canal no tiene precio, se usa el
          precio base del producto.
        </p>
      </header>

      <Card>
        <Card.Header>
          <Card.Title>Producto</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-2">
          {productsQ.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <select
              className="w-full rounded-lg border border-foreground/10 bg-default px-3 py-2"
              onChange={(e) => setProductId(Number(e.target.value) || null)}
              value={productId ?? ""}
            >
              <option value="">— Selecciona —</option>
              {productsQ.data?.data.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} · {p.name} (base: {CLP.format(p.price_clp)})
                </option>
              ))}
            </select>
          )}
        </Card.Content>
      </Card>

      {productId !== null && <ChannelPriceEditor productId={productId} queryClient={queryClient} />}
    </div>
  );
}

function ChannelPriceEditor({
  productId,
  queryClient,
}: {
  productId: number;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const pricesQ = useQuery({
    queryKey: ["channel-prices", productId],
    queryFn: () => catalogORPCClient.listChannelPrices({ id: productId }),
  });

  if (pricesQ.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }
  const existing = new Map(pricesQ.data?.data.map((cp) => [cp.channel, cp]) ?? []);

  return (
    <Card>
      <Card.Header>
        <Card.Title>Precios por canal</Card.Title>
      </Card.Header>
      <Card.Content className="space-y-3">
        {CHANNELS.map((channel) => (
          <ChannelRow
            channel={channel}
            currentPrice={existing.get(channel)?.price_clp ?? null}
            key={channel}
            onSaved={() =>
              queryClient.invalidateQueries({ queryKey: ["channel-prices", productId] })
            }
            productId={productId}
          />
        ))}
      </Card.Content>
    </Card>
  );
}

function ChannelRow({
  channel,
  currentPrice,
  productId,
  onSaved,
}: {
  channel: Channel;
  currentPrice: number | null;
  productId: number;
  onSaved: () => void;
}) {
  const [price, setPrice] = useState<string>(currentPrice !== null ? String(currentPrice) : "");

  const upsert = useMutation({
    mutationFn: () =>
      catalogORPCClient.upsertChannelPrice({
        product_id: productId,
        channel,
        price_clp: Number(price),
      }),
    onSuccess: onSaved,
  });
  const del = useMutation({
    mutationFn: () => catalogORPCClient.deleteChannelPrice({ product_id: productId, channel }),
    onSuccess: () => {
      setPrice("");
      onSaved();
    },
  });

  return (
    <div className="flex items-end gap-3">
      <div className="w-40 font-semibold text-sm">{channel.replace(/_/g, " ")}</div>
      <TextField className="flex-1" onChange={setPrice} value={price}>
        <Label className="sr-only">Precio {channel}</Label>
        <Input placeholder="CLP" type="number" />
      </TextField>
      <Button
        isDisabled={!price || upsert.isPending}
        onPress={() => upsert.mutate()}
        size="sm"
        variant="primary"
      >
        {upsert.isPending ? "…" : "Guardar"}
      </Button>
      {currentPrice !== null && (
        <Button isDisabled={del.isPending} onPress={() => del.mutate()} size="sm" variant="danger">
          {del.isPending ? "…" : "Quitar"}
        </Button>
      )}
    </div>
  );
}
