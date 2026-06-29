import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { ShopShell } from "@/components/ShopShell";
import { CheckoutView } from "@/features/shop/components/CheckoutView";
import { shopKeys } from "@/features/shop/queries";
import { checkoutClient } from "@/lib/orpc-client";

function CheckoutPage() {
  const cartQ = useQuery(shopKeys.cart());
  const cart = cartQ.data?.data;
  // Static list (communes change ~never) → cache hard so the picker is instant.
  const communesQ = useQuery({
    queryKey: ["shop", "communes"],
    queryFn: async () => (await checkoutClient.communes()).data.communes,
    staleTime: Infinity,
  });

  return (
    <ShopShell>
      <CheckoutView
        cart={cart}
        communes={communesQ.data ?? []}
        isCartLoading={cartQ.isLoading}
        onQuote={async (county) => {
          const res = await checkoutClient.quote({ destination_county_code: county });
          return res.data.options;
        }}
        onStart={async ({ customer, shipping }) => {
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
                    county_code: shipping.countyCode ?? "",
                    address: shipping.address ?? { street: "", city: "", region: "" },
                    ...(shipping.serviceCode ? { service_code: shipping.serviceCode } : {}),
                  },
          });
          // Checkout Pro: hand off to the MP-hosted checkout (all payment methods).
          // It redirects back to /pedido/$number (back_urls) where status polls.
          window.location.href = res.data.init_point;
        }}
      />
    </ShopShell>
  );
}

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});
