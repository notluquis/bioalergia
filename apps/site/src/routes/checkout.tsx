import { initMercadoPago } from "@mercadopago/sdk-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { ShopShell } from "@/components/ShopShell";
import { CheckoutView } from "@/features/shop/components/CheckoutView";
import { shopKeys } from "@/features/shop/queries";
import { checkoutClient } from "@/lib/orpc-client";

const PUBLIC_KEY = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY as string | undefined;

function CheckoutPage() {
  const navigate = useNavigate();
  const cartQ = useQuery(shopKeys.cart());
  const cart = cartQ.data?.data;

  useEffect(() => {
    if (PUBLIC_KEY) {
      initMercadoPago(PUBLIC_KEY, { locale: "es-CL" });
    }
  }, []);

  return (
    <ShopShell>
      <CheckoutView
        cart={cart}
        isCartLoading={cartQ.isLoading}
        onQuote={async (county) => {
          const res = await checkoutClient.quote({ destination_county_code: county });
          return res.data.options;
        }}
        onStart={async ({ customer, shipping, brick }) => {
          const res = await checkoutClient.start({
            customer: {
              email: customer.email,
              name: customer.name,
              rut: customer.rut || undefined,
            },
            billing_type: customer.rut ? "FACTURA" : "BOLETA",
            shipping:
              shipping.method === "pickup"
                ? { method: "pickup" }
                : {
                    method: "chilexpress",
                    address: shipping.address ?? { street: "", city: "", region: "" },
                    ...(shipping.serviceCode ? { service_code: shipping.serviceCode } : {}),
                  },
            brick,
          });
          const num = res.data.order_number;
          void navigate({
            to: "/pedido/$number",
            params: { number: num },
            search: { email: customer.email },
          });
        }}
        publicKey={PUBLIC_KEY}
      />
    </ShopShell>
  );
}

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});
