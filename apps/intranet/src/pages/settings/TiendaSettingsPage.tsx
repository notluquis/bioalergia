import { Button, Card, Form, Input, Label, NumberField } from "@heroui/react";
import { useState } from "react";

import { useToast } from "@/context/ToastContext";
import { useSettings } from "@/features/settings/hooks/use-settings";

export function TiendaSettingsPage() {
  const { settings, updateSettings, loading } = useSettings();
  const toast = useToast();
  const [low, setLow] = useState<number>(() =>
    Number.parseInt(settings.shopLowStockThreshold || "3", 10)
  );

  if (loading) {
    return <p>Cargando…</p>;
  }

  return (
    <Card className="max-w-xl">
      <Card.Header>
        <Card.Title>Configuración de la tienda</Card.Title>
        <Card.Description>
          Parámetros visibles para clientes en el storefront público.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              try {
                await updateSettings({
                  ...settings,
                  shopLowStockThreshold: String(low),
                });
                toast.success("Configuración guardada");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Error");
              }
            })();
          }}
          validationBehavior="aria"
        >
          <NumberField maxValue={99} minValue={0} onChange={(v) => setLow(Number(v))} value={low}>
            <Label>Umbral &quot;Últimas unidades&quot;</Label>
            <NumberField.Group>
              <NumberField.DecrementButton />
              <Input />
              <NumberField.IncrementButton />
            </NumberField.Group>
            <p className="mt-1 text-foreground/60 text-xs">
              Cuando el stock efectivo (available_qty − safety_stock) cae a este valor o menos, el
              badge cambia a &quot;Últimas unidades&quot;.
            </p>
          </NumberField>

          <Button className="mt-4" type="submit" variant="primary">
            Guardar
          </Button>
        </Form>
      </Card.Content>
    </Card>
  );
}
