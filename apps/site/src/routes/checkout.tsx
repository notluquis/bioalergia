import { Alert, Card } from "@heroui/react";
import { createFileRoute, Link } from "@tanstack/react-router";

function CheckoutPage() {
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
          <Card.Title>Próximamente</Card.Title>
          <Card.Description>
            MercadoPago Brick + Chilexpress shipping en construcción.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <Alert status="accent">
            <Alert.Content>
              <Alert.Description>
                Estamos terminando la integración de pago. Vuelve pronto.
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
