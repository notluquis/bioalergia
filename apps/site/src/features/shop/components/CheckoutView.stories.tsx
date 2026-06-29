import type { Meta, StoryObj } from "@storybook/react-vite";

import { SHOP_FIXTURES } from "../../../../.storybook/msw-handlers";
import { CheckoutView } from "./CheckoutView";

// Snapshotea el checkout en sus estados (formulario / carrito vacío / cargando)
// para que Chromatic detecte regresiones del formulario de contacto, el bloque
// de envío y el resumen. El pago es Checkout Pro (un botón que redirige a
// MercadoPago), así que no se monta ningún brick. El carrito sale de los
// fixtures anclados al contrato (cart).
const meta: Meta<typeof CheckoutView> = {
  title: "Shop/CheckoutView",
  component: CheckoutView,
  parameters: {
    layout: "fullscreen",
    chromatic: { viewports: [1280, 390] },
  },
  args: {
    communes: [
      { code: "STGO", name: "Santiago", region: "Metropolitana de Santiago" },
      { code: "CCP", name: "Concepción", region: "Biobío" },
      { code: "VINA", name: "Viña del Mar", region: "Valparaíso" },
    ],
    onQuote: () =>
      Promise.resolve(
        SHOP_FIXTURES.checkoutQuote.data.options.map((o) => ({
          service_code: o.code,
          service_description: o.label,
          shipping_clp: o.price_clp,
          delivery_time_days: String(o.eta_days),
        }))
      ),
    onStart: () => Promise.resolve(),
  },
};

export default meta;

type Story = StoryObj<typeof CheckoutView>;

export const Form: Story = {
  args: {
    cart: SHOP_FIXTURES.cart.data,
    isCartLoading: false,
  },
};

export const EmptyCart: Story = {
  args: {
    cart: SHOP_FIXTURES.emptyCart.data,
    isCartLoading: false,
  },
};

export const Loading: Story = {
  args: {
    cart: undefined,
    isCartLoading: true,
  },
};
