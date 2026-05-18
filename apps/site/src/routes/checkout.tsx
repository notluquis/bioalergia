import type { CheckoutContract } from "@finanzas/orpc-contracts/checkout";
import { Alert, Button, Card, Input, Label, TextField } from "@heroui/react";
import type { InferContractRouterOutputs } from "@orpc/contract";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { CLP_FORMATTER } from "@/features/shop/lib/shop-config";
import { checkoutClient } from "@/lib/orpc-client";

type QuoteOption =
  InferContractRouterOutputs<CheckoutContract>["quote"]["data"]["options"][number];

function CheckoutPage() {
  const [comuna, setComuna] = useState("");
  const [options, setOptions] = useState<QuoteOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const quoteMutation = useMutation({
    mutationFn: (countyCode: string) =>
      checkoutClient.quote({ destination_county_code: countyCode }),
    onSuccess: (res) => {
      setOptions(res.data.options);
      setError(null);
    },
    onError: (e) => {
      setOptions([]);
      setError(e instanceof Error ? e.message : "Error");
    },
  });

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <Link className="text-foreground/60 text-sm hover:underline" to="/carrito">
          ← Volver al carrito
        </Link>
        <h1 className="mt-2 font-bold text-3xl">Checkout</h1>
      </header>

      <Card>
        <Card.Header>
          <Card.Title>Cotizar envío Chilexpress</Card.Title>
          <Card.Description>
            Ingresa el código de comuna de destino (ej. ñuñoa = NUO, providencia = PRO).
          </Card.Description>
        </Card.Header>
        <Card.Content className="space-y-3">
          <TextField onChange={setComuna} value={comuna}>
            <Label>Código de comuna</Label>
            <Input placeholder="STGO" />
          </TextField>
          <Button
            isDisabled={!comuna || quoteMutation.isPending}
            onPress={() => quoteMutation.mutate(comuna.toUpperCase())}
            variant="primary"
          >
            {quoteMutation.isPending ? "Cotizando…" : "Cotizar"}
          </Button>

          {error && (
            <Alert status="danger">
              <Alert.Content>
                <Alert.Description>{error}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          {options.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="font-semibold text-sm">Opciones disponibles:</p>
              {options.map((o) => (
                <div
                  className="flex items-center justify-between rounded-lg border border-foreground/10 p-3"
                  key={o.service_code}
                >
                  <div>
                    <p className="font-medium text-sm">{o.service_description}</p>
                    <p className="text-foreground/60 text-xs">
                      {o.delivery_time_days ? `Entrega: ${o.delivery_time_days}` : ""}
                    </p>
                  </div>
                  <p className="font-bold">{CLP_FORMATTER.format(o.shipping_clp)}</p>
                </div>
              ))}
            </div>
          )}
        </Card.Content>
      </Card>

      <Card variant="secondary">
        <Card.Content>
          <Alert status="accent">
            <Alert.Content>
              <Alert.Description>
                Pago MercadoPago en construcción. Confirma tu cotización por WhatsApp mientras
                tanto.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        </Card.Content>
      </Card>
    </main>
  );
}

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});
