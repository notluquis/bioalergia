import type { CartContract } from "@finanzas/orpc-contracts/cart";
import type { CheckoutContract } from "@finanzas/orpc-contracts/checkout";
import {
  Alert,
  Breadcrumbs,
  Button,
  Card,
  ComboBox,
  Input,
  Label,
  ListBox,
  TextField,
} from "@heroui/react";
import type { InferContractRouterOutputs } from "@orpc/contract";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Eyebrow } from "@/components/ui/Eyebrow";
import { TrustBlock } from "@/features/shop/components/TrustBlock";
import { computeOrderTotal, pickCheapestShippingOption } from "@/features/shop/lib/checkout-math";
import { lineTotalClp } from "@/features/shop/lib/cart-math";
import { CLP_FORMATTER } from "@/features/shop/lib/shop-config";

// Presentational view for /checkout. Owns the local FORM state (contact fields,
// shipping selection, quote options) because that is pure UI state, but takes
// the data operations (`onQuote`, `onStart`) and async flags as plain props so
// it can be mounted in Storybook. NO data fetching, NO Route.* hooks here.

type QuoteOption = InferContractRouterOutputs<CheckoutContract>["quote"]["data"]["options"][number];
type Cart = InferContractRouterOutputs<CartContract>["get"]["data"];
type CartItem = Cart["items"][number];

export type CheckoutCustomer = { email: string; name: string; rut: string };
export type CheckoutShipping = {
  method: "pickup" | "chilexpress";
  serviceCode: string | null;
  address?: { street: string; city: string; region: string };
  /** Chilexpress coverage code of the chosen comuna (server re-quotes with it). */
  countyCode?: string;
};

export type CheckoutViewProps = {
  cart: Cart | undefined;
  isCartLoading: boolean;
  /** Chilexpress communes (name → coverage code + region) for the comuna picker. */
  communes: Array<{ code: string; name: string; region: string }>;
  /** Quote a county; resolves to the available shipping options. */
  onQuote: (county: string) => Promise<QuoteOption[]>;
  /** Create the order + MP preference, then redirect to the hosted checkout. */
  onStart: (input: { customer: CheckoutCustomer; shipping: CheckoutShipping }) => Promise<void>;
};

export function CheckoutView({
  cart,
  isCartLoading,
  communes,
  onQuote,
  onStart,
}: CheckoutViewProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [rut, setRut] = useState("");
  const [comuna, setComuna] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [shippingMethod, setShippingMethod] = useState<"pickup" | "chilexpress">("pickup");
  const [shippingClp, setShippingClp] = useState(0);
  const [quoteOptions, setQuoteOptions] = useState<QuoteOption[]>([]);
  const [serviceCode, setServiceCode] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalClp = useMemo(
    () => computeOrderTotal(cart?.total_clp ?? 0, shippingClp),
    [cart, shippingClp]
  );

  if (isCartLoading) return <p className="px-4 py-12 text-muted">Cargando…</p>;
  if (!cart || cart.items.length === 0) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-12 sm:px-6">
        <Alert status="warning">
          <Alert.Content>
            <Alert.Description>
              Tu carrito está vacío.{" "}
              <Link className="text-brand-blue underline" to="/tienda">
                Ir a la tienda
              </Link>
            </Alert.Description>
          </Alert.Content>
        </Alert>
      </main>
    );
  }

  const customerReady = email.includes("@") && name.length >= 2;
  // Street must carry a number — Chilexpress can't deliver to a street with no
  // house number (we can't verify it against their API yet; this is the cheap
  // client check). The comuna itself is already validated (from the coverage list).
  const streetHasNumber = /\d/.test(street);
  const shippingReady =
    shippingMethod === "pickup" ||
    (Boolean(serviceCode) &&
      street.trim().length >= 2 &&
      streetHasNumber &&
      city.trim().length >= 2 &&
      region.trim().length >= 2);

  const runQuote = () => {
    setIsQuoting(true);
    onQuote(comuna.toUpperCase())
      .then((options) => {
        setQuoteOptions(options);
        setQuoteError(null);
        const cheapest = pickCheapestShippingOption(options);
        if (cheapest) {
          setShippingClp(cheapest.shipping_clp);
          setServiceCode(cheapest.service_code);
        }
      })
      .catch((e: unknown) => {
        setQuoteError(e instanceof Error ? e.message : "Error cotizando");
      })
      .finally(() => setIsQuoting(false));
  };

  const handlePay = () => {
    setIsSubmitting(true);
    setSubmitError(null);
    onStart({
      customer: { email, name, rut },
      shipping: {
        method: shippingMethod,
        serviceCode,
        ...(shippingMethod === "chilexpress"
          ? {
              countyCode: comuna,
              address: { street: street.trim(), city: city.trim(), region: region.trim() },
            }
          : {}),
      },
    }).catch((e: unknown) => {
      // On success the page redirects to MercadoPago, so we only land here on error.
      setSubmitError(e instanceof Error ? e.message : "No pudimos iniciar el pago");
      setIsSubmitting(false);
    });
  };

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-12 sm:px-6">
      <Breadcrumbs>
        <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/tienda">Tienda</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/carrito">Carrito</Breadcrumbs.Item>
        <Breadcrumbs.Item>Checkout</Breadcrumbs.Item>
      </Breadcrumbs>

      <header className="space-y-3">
        <Eyebrow>Finalizar compra</Eyebrow>
        <h1 className="font-display text-[2rem] text-foreground sm:text-[2.5rem]">Checkout</h1>
      </header>

      <TrustBlock compact />

      <Card className="rounded-3xl border-line bg-surface" variant="default">
        <Card.Header className="gap-1">
          <Eyebrow tone="muted">Paso 1</Eyebrow>
          <Card.Title className="font-display text-xl text-foreground">Contacto</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-3">
          <TextField onChange={setEmail} value={email}>
            <Label>Email</Label>
            <Input type="email" placeholder="tu@email.cl" />
          </TextField>
          <TextField onChange={setName} value={name}>
            <Label>Nombre completo</Label>
            <Input />
          </TextField>
          <TextField onChange={setRut} value={rut}>
            <Label>RUT (opcional, solo si quieres factura)</Label>
            <Input placeholder="12.345.678-9" />
          </TextField>
        </Card.Content>
      </Card>

      <Card className="rounded-3xl border-line bg-surface" variant="default">
        <Card.Header className="gap-1">
          <Eyebrow tone="muted">Paso 2</Eyebrow>
          <Card.Title className="font-display text-xl text-foreground">Envío</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-3">
          <div className="flex gap-2">
            <Button
              onPress={() => {
                setShippingMethod("pickup");
                setShippingClp(0);
              }}
              variant={shippingMethod === "pickup" ? "primary" : "secondary"}
            >
              Retiro en clínica · Gratis
            </Button>
            <Button
              onPress={() => setShippingMethod("chilexpress")}
              variant={shippingMethod === "chilexpress" ? "primary" : "secondary"}
            >
              Chilexpress
            </Button>
          </div>

          {shippingMethod === "chilexpress" && (
            <div className="space-y-2">
              <TextField isRequired onChange={setStreet} value={street}>
                <Label>Calle y número</Label>
                <Input
                  autoComplete="street-address"
                  maxLength={160}
                  placeholder="Av. Siempre Viva 742"
                />
              </TextField>
              {street.trim().length >= 2 && !streetHasNumber ? (
                <p className="text-danger text-sm">Incluye el número de la dirección.</p>
              ) : null}
              <ComboBox
                onSelectionChange={(key) => {
                  const c = communes.find((x) => x.code === key);
                  setComuna(c?.code ?? "");
                  setCity(c?.name ?? "");
                  setRegion(c?.region ?? "");
                  // comuna changed → previous quote no longer applies.
                  setQuoteOptions([]);
                  setServiceCode(null);
                  setShippingClp(0);
                }}
                selectedKey={comuna || null}
              >
                <Label>Comuna</Label>
                <ComboBox.InputGroup>
                  <Input placeholder="Escribe tu comuna…" />
                  <ComboBox.Trigger />
                </ComboBox.InputGroup>
                <ComboBox.Popover>
                  <ListBox items={communes}>
                    {(c: { code: string; name: string; region: string }) => (
                      <ListBox.Item id={c.code} textValue={c.name}>
                        {c.name}
                        {c.region ? ` · ${c.region}` : ""}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    )}
                  </ListBox>
                </ComboBox.Popover>
              </ComboBox>
              <Button
                isDisabled={!comuna || isQuoting}
                onPress={runQuote}
                size="sm"
                variant="secondary"
              >
                {isQuoting ? "Cotizando…" : "Cotizar envío"}
              </Button>
              {quoteError && <p className="text-danger text-sm">{quoteError}</p>}
              {quoteOptions.map((o) => (
                <button
                  aria-label={`${o.service_description} — ${CLP_FORMATTER.format(o.shipping_clp)}`}
                  className={`block w-full rounded-2xl border p-3 text-left text-sm transition ${
                    serviceCode === o.service_code
                      ? "border-brand-amber bg-brand-amber/10"
                      : "border-line hover:border-brand-blue"
                  }`}
                  key={o.service_code}
                  onClick={() => {
                    setServiceCode(o.service_code);
                    setShippingClp(o.shipping_clp);
                  }}
                  type="button"
                >
                  <span className="flex justify-between text-foreground">
                    <span>{o.service_description}</span>
                    <span className="font-bold">{CLP_FORMATTER.format(o.shipping_clp)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card.Content>
      </Card>

      <Card className="rounded-3xl border-line bg-surface" variant="default">
        <Card.Header className="gap-1">
          <Eyebrow tone="muted">Resumen</Eyebrow>
          <Card.Title className="font-display text-xl text-foreground">Tu pedido</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-2 text-sm">
          {cart.items.map((i: CartItem) => (
            <div className="flex justify-between text-foreground" key={i.id}>
              <span className="text-muted">
                {i.qty}× {i.product.name}
              </span>
              <span>{CLP_FORMATTER.format(lineTotalClp(i.unit_price_clp, i.qty))}</span>
            </div>
          ))}
          <div className="flex justify-between border-line border-t pt-2 text-foreground">
            <span className="text-muted">Subtotal</span>
            <span>{CLP_FORMATTER.format(cart.subtotal_clp)}</span>
          </div>
          <div className="flex justify-between text-foreground">
            <span className="text-muted">Envío</span>
            <span>{CLP_FORMATTER.format(shippingClp)}</span>
          </div>
          <div className="flex justify-between border-line border-t pt-3 font-bold text-base text-foreground">
            <span>Total</span>
            <span>{CLP_FORMATTER.format(totalClp)}</span>
          </div>
          <p className="text-muted text-xs">IVA incluido</p>
        </Card.Content>
      </Card>

      <Card className="rounded-3xl border-line bg-surface" variant="default">
        <Card.Header className="gap-1">
          <Eyebrow tone="muted">Paso 3</Eyebrow>
          <Card.Title className="font-display text-xl text-foreground">Pago</Card.Title>
          <Card.Description className="text-muted">
            Tarjeta de crédito/débito · Webpay · MercadoPago
          </Card.Description>
        </Card.Header>
        <Card.Content>
          {!(customerReady && shippingReady) && (
            <Alert status="accent">
              <Alert.Content>
                <Alert.Description>
                  {!customerReady
                    ? "Completa tu email y nombre arriba."
                    : "Completa tu dirección de envío y elige un servicio Chilexpress."}
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          {customerReady && shippingReady && (
            <Button
              className="w-full"
              isDisabled={isSubmitting}
              onPress={handlePay}
              variant="primary"
            >
              {isSubmitting ? "Redirigiendo a Mercado Pago…" : "Pagar con Mercado Pago"}
            </Button>
          )}

          {submitError && (
            <Alert status="danger">
              <Alert.Content>
                <Alert.Description>{submitError}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
        </Card.Content>
      </Card>
    </main>
  );
}
