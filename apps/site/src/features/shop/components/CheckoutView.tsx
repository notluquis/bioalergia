import type { CartContract } from "@finanzas/orpc-contracts/cart";
import type { CheckoutContract } from "@finanzas/orpc-contracts/checkout";
import { Alert, Breadcrumbs, Button, Card, Input, Label, TextField } from "@heroui/react";
import { Payment } from "@mercadopago/sdk-react";
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

/** The brick payload shape the route's `start` mutation accepts. */
export type BrickSubmission = {
  token: string;
  payment_method_id: string;
  issuer_id?: string;
  installments: number;
  payer: {
    email: string;
    identification?: { type: string; number: string };
  };
};

export type CheckoutCustomer = { email: string; name: string; rut: string };
export type CheckoutShipping = {
  method: "pickup" | "chilexpress";
  serviceCode: string | null;
  address?: { street: string; city: string; region: string };
};

export type CheckoutViewProps = {
  /** MercadoPago public key; null/undefined renders the "missing key" alert. */
  publicKey: string | null | undefined;
  cart: Cart | undefined;
  isCartLoading: boolean;
  /** Quote a county; resolves to the available shipping options. */
  onQuote: (county: string) => Promise<QuoteOption[]>;
  /** Start the order with the collected customer/shipping + MP brick payload. */
  onStart: (input: {
    customer: CheckoutCustomer;
    shipping: CheckoutShipping;
    brick: BrickSubmission;
  }) => Promise<void>;
};

export function CheckoutView({
  publicKey,
  cart,
  isCartLoading,
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

  const totalClp = useMemo(
    () => computeOrderTotal(cart?.total_clp ?? 0, shippingClp),
    [cart, shippingClp]
  );

  if (!publicKey) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-12 sm:px-6">
        <Alert status="danger">
          <Alert.Content>
            <Alert.Description>
              Falta `VITE_MERCADOPAGO_PUBLIC_KEY`. Contacta soporte.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      </main>
    );
  }

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
  // Chilexpress needs a real address (contract min(2)) + a chosen service before paying.
  const shippingReady =
    shippingMethod === "pickup" ||
    (Boolean(serviceCode) &&
      street.trim().length >= 2 &&
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
            // ponytail: región/comuna are free text + a manual coverage code. A
            // comuna selector that yields code+name+region (one Chilexpress
            // coverage fetch) is the upgrade if order volume justifies it.
            <div className="space-y-2">
              <TextField isRequired onChange={setStreet} value={street}>
                <Label>Calle y número</Label>
                <Input
                  autoComplete="street-address"
                  maxLength={160}
                  placeholder="Av. Siempre Viva 742"
                />
              </TextField>
              <TextField isRequired onChange={setCity} value={city}>
                <Label>Comuna / Ciudad</Label>
                <Input autoComplete="address-level2" maxLength={80} placeholder="Concepción" />
              </TextField>
              <TextField isRequired onChange={setRegion} value={region}>
                <Label>Región</Label>
                <Input autoComplete="address-level1" maxLength={80} placeholder="Biobío" />
              </TextField>
              <TextField onChange={setComuna} value={comuna}>
                <Label>Código comuna (para cotizar)</Label>
                <Input placeholder="STGO / NUO / VINA…" />
              </TextField>
              <Button
                isDisabled={!comuna || isQuoting}
                onPress={runQuote}
                size="sm"
                variant="secondary"
              >
                {isQuoting ? "Cotizando…" : "Cotizar"}
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
            <Payment
              initialization={{
                amount: totalClp,
                payer: { email },
              }}
              customization={{
                paymentMethods: {
                  creditCard: "all",
                  debitCard: "all",
                  mercadoPago: "all",
                },
                visual: { hideFormTitle: true },
              }}
              onSubmit={async ({ formData }) => {
                setSubmitError(null);
                try {
                  await onStart({
                    customer: { email, name, rut },
                    shipping: {
                      method: shippingMethod,
                      serviceCode,
                      ...(shippingMethod === "chilexpress"
                        ? {
                            address: {
                              street: street.trim(),
                              city: city.trim(),
                              region: region.trim(),
                            },
                          }
                        : {}),
                    },
                    brick: {
                      token: formData.token,
                      payment_method_id: formData.payment_method_id,
                      ...(formData.issuer_id ? { issuer_id: formData.issuer_id } : {}),
                      installments: formData.installments ?? 1,
                      payer: {
                        email: formData.payer.email,
                        ...(formData.payer.identification
                          ? { identification: formData.payer.identification }
                          : {}),
                      },
                    },
                  });
                } catch (e) {
                  setSubmitError(e instanceof Error ? e.message : "Error procesando pago");
                }
              }}
              onError={(e) => setSubmitError(`MP: ${e?.message ?? "error"}`)}
            />
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
