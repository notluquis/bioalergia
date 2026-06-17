import type { Meta, StoryObj } from "@storybook/react-vite";

import { SHOP_FIXTURES } from "../../../../.storybook/msw-handlers";
import { CheckoutView } from "./CheckoutView";

// Snapshotea el checkout en sus estados (formulario / carrito vacío / falta MP
// key / cargando) para que Chromatic detecte regresiones del formulario de
// contacto, el bloque de envío y el resumen. No monta el brick de MercadoPago
// porque por defecto el formulario está vacío (customerReady=false). El carrito
// sale de los fixtures anclados al contrato (cart).
const meta: Meta<typeof CheckoutView> = {
  title: "Shop/CheckoutView",
  component: CheckoutView,
  parameters: {
    layout: "fullscreen",
    chromatic: { viewports: [1280, 390] },
  },
  args: {
    // Stubs: the brick (MercadoPago) only mounts once the form is filled, so
    // these are never invoked in the default snapshots.
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
    publicKey: "TEST-fake-public-key",
    cart: SHOP_FIXTURES.cart.data,
    isCartLoading: false,
  },
};

export const EmptyCart: Story = {
  args: {
    publicKey: "TEST-fake-public-key",
    cart: SHOP_FIXTURES.emptyCart.data,
    isCartLoading: false,
  },
};

export const MissingPublicKey: Story = {
  args: {
    publicKey: null,
    cart: SHOP_FIXTURES.cart.data,
    isCartLoading: false,
  },
};

export const Loading: Story = {
  args: {
    publicKey: "TEST-fake-public-key",
    cart: undefined,
    isCartLoading: true,
  },
};
